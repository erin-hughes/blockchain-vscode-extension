/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
*/
/* istanbul ignore file */
'use strict';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs-extra';
import { ReactView } from './ReactView';
import { ExtensionCommands } from '../../ExtensionCommands';

interface IAppState {
    gatewayName: string;
    smartContract: { name: string, version: string, channel: string, label: string, transactions: any[], namespace: string };
    associatedTxdata: undefined | { chaincodeName: string, channelName: string, transactionDataPath: string };
    txdataTransactions?: string[];
}
export class TransactionView extends ReactView {
    protected appState: any;

    constructor(context: vscode.ExtensionContext, appState: any) {
        super(context, 'transactionView', 'Transaction View');
        this.appState = appState;
    }

    async handleTransactionMessage(message: {command: string, data: any}, panel: vscode.WebviewPanel): Promise<void> {
        const response: string = await vscode.commands.executeCommand(message.command, undefined, undefined, undefined, message.data);
        panel.webview.postMessage({
            transactionOutput: response
        });
    }

    async handleTxdataMessage(message: {command: string, data: any}, panel: vscode.WebviewPanel): Promise<void> {
        const response: {chaincodeName: string, channelName: string, transactionDataPath: string} = await vscode.commands.executeCommand(message.command, undefined, message.data);
        const txdataTransactions: string[] = response !== undefined ? await this.readTxdataFiles(response.transactionDataPath) : [];
        const newAppState: IAppState = {
            gatewayName: this.appState.gatewayName,
            smartContract: this.appState.smartContract,
            associatedTxdata: response,
            txdataTransactions
        };

        panel.webview.postMessage({
            transactionViewData: newAppState
        });
    }

    async readTxdataFiles(txdataDirectoryPath: string): Promise<any> {
        const filepaths: string[] = [];
        const transactionsInFiles: string[] = [];

        const allFiles: string[] = await fs.readdir(txdataDirectoryPath);
        allFiles.forEach((file: string) => {
            if (file.endsWith('.txdata')) {
                filepaths.push(file);
            }
        });

        if (filepaths.length > 0) {
            for (const file of filepaths) {
                try {
                    const fileJson: any = await fs.readJSON(path.join(txdataDirectoryPath, file));
                    fileJson.forEach((txn: any) => {
                        transactionsInFiles.push(txn.transactionLabel ? txn.transactionLabel : txn.name);
                    });
                } catch (error) {
                    // TODO deal with this error
                }
            }
        }
        return transactionsInFiles;
    }

    async openPanelInner(panel: vscode.WebviewPanel): Promise<void> {
        panel.webview.onDidReceiveMessage(async (message: {command: string, data: any}) => {
            if (message.command === ExtensionCommands.SUBMIT_TRANSACTION || message.command === ExtensionCommands.EVALUATE_TRANSACTION) {
                await this.handleTransactionMessage(message, panel);
            } else {
                await this.handleTxdataMessage(message, panel);
            }
        });
        await this.loadComponent(panel);
    }

    async loadComponent(panel: vscode.WebviewPanel): Promise<void> {
        if (this.appState.associatedTxdata !== undefined) {
            this.appState.txdataTransactions = await this.readTxdataFiles(this.appState.associatedTxdata.transactionDataPath);
        }

        panel.webview.postMessage({
            path: '/transaction',
            transactionViewData: this.appState
        });
    }
}
