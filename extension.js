// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require("vscode");

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log(
    'Congratulations, your extension "stroveteams" is now active!!!!!'
  );

  // const editor = vscode.window.activeTextEditor;
  // const position = editor.selection.active;

  vscode.languages.registerHoverProvider("*", {
    provideHover(document, position, token) {
      console.log(
        "hovered document",
        document,
        "hovered position",
        position,
        "token",
        token
      );
      return new vscode.Hover("I am a hover!");
    }
  });

  //   var newPosition = position.with(position.line, 0);
  //   var newSelection = new vscode.Selection(newPosition, newPosition);

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with  registerCommand
  // The commandId parameter must match the command field in package.json
  let disposable = vscode.commands.registerCommand(
    "extension.helloWorld",
    function() {
      // The code you place here will be executed every time your command is executed

      // Display a message box to the user
      vscode.window.showInformationMessage("Hello World!");
    }
  );

  context.subscriptions.push(disposable);
}

exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() {}

module.exports = {
  activate,
  deactivate
};

/*
	Liveshare sessions structure - used to determine active file and cursor position
	Created on first joinLiveshare mutation in a given project
	Cursor position updated on hover
	
	Note: It seems its best to make a separate subscription to prevent sending huge amounts
	of data many times a second
	*/
const projects = {
  // projectId
  projectId1: {
    user1Id: {
      documentUrl: "/src/assets/index.html",
      position: {
        x: 11,
        y: 2
      }
    },
    user2Id: {
      documentUrl: "/package.json",
      position: {
        x: 1,
        y: 1
      }
    }
  },
  // projectId
  project456Id: {
    user13455ID: {
      documentUrl: "/index.ts",
      position: {
        x: 1,
        y: 1
      }
    }
  }
};
