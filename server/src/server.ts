/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

import {
	createConnection,
	TextDocuments,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	DocumentFormattingParams,
	TextEdit,
	Range,
	DocumentRangeFormattingParams,
	TextDocumentIdentifier
} from 'vscode-languageserver';
import { spawn } from 'child_process';
import { tmpdir } from 'os';
import { resolve } from 'path';
import { writeFileSync, readFileSync } from 'fs';
import uuid = require('uuid');
// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
let connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager. The text document manager
// supports full document sync only
let documents: TextDocuments = new TextDocuments();

let hasConfigurationCapability: boolean = false;
let hasWorkspaceFolderCapability: boolean = false;

connection.onInitialize((params: InitializeParams) => {
	let capabilities = params.capabilities;

	// Does the client support the `workspace/configuration` request?
	// If not, we will fall back using global settings
	hasConfigurationCapability =
		capabilities.workspace && !!capabilities.workspace.configuration;
	hasWorkspaceFolderCapability =
		capabilities.workspace && !!capabilities.workspace.workspaceFolders;

	return {
		capabilities: {
			textDocumentSync: documents.syncKind,
			// Tell the client that the server supports code completion
			documentFormattingProvider: true,
			documentRangeFormattingProvider: true
		}
	};
});

connection.onInitialized(() => {
	if (hasConfigurationCapability) {
		// Register for all configuration changes.
		connection.client.register(
			DidChangeConfigurationNotification.type,
			undefined
		);
	}
	if (hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders(_event => {
			connection.console.log('Workspace folder change event received.');
		});
	}
});

// The example settings
interface ExampleSettings {
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: ExampleSettings = {  };

// Cache the settings of all open documents
let documentSettings: Map<string, Thenable<ExampleSettings>> = new Map();

connection.onDidChangeConfiguration(change => {
	if (hasConfigurationCapability) {
		// Reset all cached document settings
		documentSettings.clear();
	} else {
	}

});

// Only keep settings for open documents
documents.onDidClose(e => {
	documentSettings.delete(e.document.uri);
});

connection.onDocumentFormatting((params : DocumentFormattingParams) =>
	doFormatting(params.textDocument)
);

connection.onDocumentRangeFormatting((params: DocumentRangeFormattingParams) =>
	doFormatting(params.textDocument, params.range)
);


const doFormatting = (docId: TextDocumentIdentifier, range?: Range): Promise<TextEdit[]> => {
	const doc = documents.get(docId.uri);
	const text = doc.getText(range);

	return new Promise((res) => {
		connection.console.log("formatting provider");
		
		const tmpfile = resolve(tmpdir(), "erlang-formatter-" + uuid() + ".erl");
		writeFileSync(tmpfile, text);

		const sh = resolve(__dirname, "../erlang-formatter/fmt.sh");
		const cp = spawn(sh, [ tmpfile ]);

		cp.stdout.on('data', (data) => {
			connection.console.log(`stdout: ${data}`);
		});
		
		cp.stderr.on('data', (data) => {
			connection.console.log(`stderr: ${data}`);
		});
		
		cp.on('close', (code) => {
			connection.console.log(`child process exited with code ${code}`);
			if (code === 0) {
				const updated = readFileSync(tmpfile, 'utf8');
				connection.console.log(updated);
				
				const edit: TextEdit = {
					range: range ? range : Range.create(0, 0, -1, -1),
					newText: updated
				};
				res([edit]);
			}
		});
	});
};

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
