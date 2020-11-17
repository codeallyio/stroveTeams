const vscode = require("vscode");
const Sentry = require("@sentry/node");
const { execute, makePromise } = require("apollo-link");
const { websocketLink } = require("./websocketLink");
const {
  receiveAutomaticTestSubscription,
  setProjectDataMutation,
} = require("./queries");
const child_process = require("child_process");
const { sendLog } = require("./debugger");

const environment = process.env.STROVE_ENVIRONMENT;

Sentry.init({
  beforeSend(event) {
    if (environment === "production") {
      return event;
    }
    return null;
  },
  dsn:
    "https://8acd5bf9eafc402b8666e9d55186f620@o221478.ingest.sentry.io/5285294",
  maxValueLength: 1000,
  normalizeDepth: 10,
});

const receiveTerminalOperation = {
  query: receiveAutomaticTestSubscription,
  variables: {
    projectId: process.env.STROVE_PROJECT_ID || "123abc",
  },
};

let autoTestTerminalSubscriber = null;
let testProcess;

const startAutomaticTest = () => {
  // Start terminal if ping arrives
  autoTestTerminalSubscriber = execute(
    websocketLink,
    receiveTerminalOperation
  ).subscribe({
    next: async (data) => {
      try {
        const {
          data: { automaticTest },
        } = data;

        if (
          automaticTest &&
          automaticTest.command.includes("strove_receive_automatic_test_ping")
        ) {
          const terminalWriter = await startTestTerminal();

          testProcess = {
            process: child_process.spawn("/bin/bash"),
            send: () => {
              // Important to end process with ; exit\n
              sendLog(
                `cd ~/project/${automaticTest.folderName} && ${automaticTest.testStartCommand} ; exit\n`
              );
              testProcess.process.stdin.write(
                `cd ~/project/${automaticTest.folderName} && ${automaticTest.testStartCommand} ; exit\n`
              );
            },
            initEvents: () => {
              // Handle Data
              testProcess.process.stdout.on("data", (buffer) => {
                sendLog(
                  `startAutomaticTest - STDOUT: ${buffer.toString("utf-8")}`
                );
                terminalWriter.write(`${buffer.toString("utf-8")}\n\r`);
              });

              testProcess.process.stderr.on("data", (buffer) => {
                sendLog(
                  `startAutomaticTest - STDERR: ${buffer.toString("utf-8")}`
                );
                terminalWriter.write(`${buffer.toString("utf-8")}\n\r`);
              });

              // Handle Closure
              testProcess.process.on("exit", (exitCode) => {
                sendLog(`startAutomaticTest - exit: ${exitCode}`);

                if (exitCode === 0) {
                  sendOutput("Test Passed.");
                } else {
                  sendOutput("Test Failed.");
                }
              });
            },
          };

          testProcess.initEvents();
          testProcess.send();
        }
      } catch (e) {
        sendLog(`startAutomaticTest - tryCatch: ${JSON.stringify(e)}`);

        console.log(
          `received error in startAutomaticTest -> autoTestTerminalSubscriber -> next ${JSON.stringify(
            e
          )}`
        );

        Sentry.withScope((scope) => {
          scope.setExtras({
            data: receiveTerminalOperation,
            location:
              "startAutomaticTest -> autoTestTerminalSubscriber -> next",
          });
          Sentry.captureException(e);
        });
      }
    },
    error: (error) => {
      sendLog(`startAutomaticTest - error: ${JSON.stringify(error)}`);
      console.log(
        `received error in autoTestTerminalSubscriber ${JSON.stringify(error)}`
      );

      Sentry.withScope((scope) => {
        scope.setExtras({
          data: receiveTerminalOperation,
          location: "startAutomaticTest -> autoTestTerminalSubscriber",
        });
        Sentry.captureException(error);
      });
    },
    complete: () => console.log(`complete`),
  });
};

const sendOutput = async (output) => {
  try {
    const setProjectData = {
      query: setProjectDataMutation,
      variables: {
        projectId: process.env.STROVE_PROJECT_ID || "123abc",
        testOutput: output,
      },
    };

    sendLog(`sendOutput - variables: ${setProjectData.variables}`);

    makePromise(execute(websocketLink, setProjectData))
      .then()
      .catch((error) => {
        console.log(`received error in sendOutput ${JSON.stringify(error)}`);

        Sentry.withScope((scope) => {
          scope.setExtras({
            data: setProjectData,
            location: "sendOutput -> mutation",
          });
          Sentry.captureException(error);
        });
      });
  } catch (e) {
    sendLog(`sendOutput - tryCatch: ${e}`);
    console.log("error in sendOutput: ", e);
    Sentry.withScope((scope) => {
      scope.setExtras({
        data: { error: e },
        location: "sendOutput",
      });
      Sentry.captureMessage("Unexpected error!");
    });
  }
};

const startTestTerminal = async () => {
  const writeEmitter = new vscode.EventEmitter();

  const pty = {
    onDidWrite: writeEmitter.event,
    open: () => {
      writeEmitter.fire(`Automatic test results will show below:\n\r\n\r`);
    },
    close: () => {
      // no-op
      return;
    },
    handleInput: () => {
      // disabling inputs
      return;
    },
  };

  const testsTerminal = vscode.window.createTerminal({
    name: `Test Results`,
    pty,
  });

  await testsTerminal.show();

  // We wait for the terminal to show up
  await new Promise((resolve) =>
    setTimeout(() => {
      resolve();
    }, 2000)
  );

  return writeEmitter;
};

module.exports = {
  startAutomaticTest,
  autoTestTerminalSubscriber,
};
