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
import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import * as chai from 'chai';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
import { ExtensionUtil } from '../../extension/util/ExtensionUtil';
import * as fs from 'fs-extra';
import * as chaiAsPromised from 'chai-as-promised';
import { dependencies, version as currentExtensionVersion } from '../../package.json';
import { SettingConfigurations } from '../../extension/configurations';
import { ExtensionData, GlobalState } from '../../extension/util/GlobalState';
import { ExtensionCommands } from '../../ExtensionCommands';
import { TutorialGalleryView } from '../../extension/webview/TutorialGalleryView';
import { HomeView } from '../../extension/webview/HomeView';
import { Fabric2View } from '../../extension/webview/Fabric2View';
import { SampleView } from '../../extension/webview/SampleView';
import { TutorialView } from '../../extension/webview/TutorialView';
import { Reporter } from '../../extension/util/Reporter';
import { PreReqView } from '../../extension/webview/PreReqView';
import { DependencyManager } from '../../extension/dependencies/DependencyManager';
import { VSCodeBlockchainOutputAdapter } from '../../extension/logging/VSCodeBlockchainOutputAdapter';
import { TemporaryCommandRegistry } from '../../extension/dependencies/TemporaryCommandRegistry';
import { UserInputUtil } from '../../extension/commands/UserInputUtil';
import {
    EnvironmentType,
    FabricEnvironmentRegistry,
    FabricEnvironmentRegistryEntry,
    FabricGatewayRegistry,
    FabricRuntimeUtil,
    FabricWalletRegistry,
    FabricWalletRegistryEntry,
    LogType,
    FileSystemUtil,
    FileConfigurations
} from 'ibm-blockchain-platform-common';
import { TestUtil } from '../TestUtil';
import * as openTransactionViewCommand from '../../extension/commands/openTransactionViewCommand';
import { FabricConnectionFactory } from '../../extension/fabric/FabricConnectionFactory';
import { FabricEnvironmentManager, ConnectedState } from '../../extension/fabric/environments/FabricEnvironmentManager';
import { FabricEnvironmentConnection } from 'ibm-blockchain-platform-environment-v1';
import Axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { FeatureFlagManager, IFeatureFlag, FeatureFlag } from '../../extension/util/FeatureFlags';
import { defaultDependencies } from '../../extension/dependencies/Dependencies';
import { LocalMicroEnvironmentManager } from '../../extension/fabric/environments/LocalMicroEnvironmentManager';
import { LocalMicroEnvironment } from '../../extension/fabric/environments/LocalMicroEnvironment';
import { SampleGalleryView } from '../../extension/webview/SampleGalleryView';

const should: Chai.Should = chai.should();
chai.use(sinonChai);
chai.use(chaiAsPromised);
// tslint:disable no-unused-expression
describe('ExtensionUtil Tests', () => {

    let mySandBox: sinon.SinonSandbox;
    const workspaceFolder: any = {
        name: 'myFolder',
        uri: vscode.Uri.file('myPath')
    };

    before(async () => {
        mySandBox = sinon.createSandbox();
        await TestUtil.setupTests(mySandBox);
    });

    afterEach(() => {
        mySandBox.restore();
    });

    describe('getPackageJSON', () => {
        it('should get the packageJSON', async () => {
            await ExtensionUtil.activateExtension();
            const packageJSON: any = ExtensionUtil.getPackageJSON();
            packageJSON.name.should.equal('ibm-blockchain-platform');
        });
    });

    describe('activateExtension', () => {
        it('should activate the extension', async () => {
            await ExtensionUtil.activateExtension();

            const isActive: boolean = vscode.extensions.getExtension('IBMBlockchain.ibm-blockchain-platform').isActive;
            isActive.should.equal(true);
        });
    });

    describe('getExtensionPath', () => {
        // skipping as path doesn't contain blockchain-vscode-extension in azure devops pipeline
        xit('should get the extension path', () => {
            const extensionPath: string = ExtensionUtil.getExtensionPath();
            extensionPath.should.contain('blockchain-vscode-extension');
        });
    });

    describe('loadJSON', () => {
        it('should return parsed workspace package.json', async () => {

            mySandBox.stub(fs, 'readFile').resolves(`{
                "name": "mySmartContract",
                "version": "0.0.1"
            }`);

            const result: any = await ExtensionUtil.loadJSON(workspaceFolder, 'package.json');
            result.should.deep.equal({
                name: 'mySmartContract',
                version: '0.0.1'
            });
        });

        it('should handle errors', async () => {

            mySandBox.stub(fs, 'readFile').throws({ message: 'Cannot read file' });

            await ExtensionUtil.loadJSON(workspaceFolder, 'package.json').should.be.rejectedWith('error reading package.json from project Cannot read file');

        });
    });

    describe('getContractNameAndVersion', () => {
        it('should get contract name and version', async () => {

            mySandBox.stub(ExtensionUtil, 'loadJSON').resolves({ name: 'projectName', version: '0.0.3' });

            const result: any = await ExtensionUtil.getContractNameAndVersion(workspaceFolder);
            result.should.deep.equal({
                name: 'projectName',
                version: '0.0.3'
            });
        });

        it('should handle errors', async () => {

            mySandBox.stub(ExtensionUtil, 'loadJSON').throws({ message: 'error reading package.json from project Cannot read file' });
            should.equal(await ExtensionUtil.getContractNameAndVersion(workspaceFolder), undefined);
        });
    });

    describe('skipNpmInstall', () => {

        it('skipNpmInstall should return false', async () => {

            const result: boolean = await ExtensionUtil.skipNpmInstall();
            result.should.equal(false);

        });
    });

    describe('checkIfIBMer', () => {
        it('should return true if ibmer', () => {
            const _interface: any = {
                lo: [
                    {
                        address: '9.125.0.1',
                        family: 'IPv4',
                    }
                ]
            };

            mySandBox.stub(os, 'networkInterfaces').returns(_interface);
            const result: boolean = ExtensionUtil.checkIfIBMer();
            result.should.equal(true);
        });

        it('should return true if ibmer (multiple)', () => {
            const _interface: any = {
                lo: [
                    {
                        address: '9.125.0.1',
                        family: 'IPv4',
                    }
                ],
                eth0: [
                    {
                        address: '192.168.1.108',
                        netmask: '255.255.255.0',
                        family: 'IPv4'
                    },
                    {
                        address: '9.168.1.108',
                        netmask: '255.255.255.0',
                        family: 'IPv6'
                    },
                ]
            };

            mySandBox.stub(os, 'networkInterfaces').returns(_interface);
            const result: boolean = ExtensionUtil.checkIfIBMer();
            result.should.equal(true);
        });

        it('should return false if not ibmer', () => {
            const _interface: any = {
                lo: [
                    {
                        address: '10.125.0.1',
                        family: 'IPv6',
                    }
                ],
                eth0: [
                    {
                        address: '192.168.1.108',
                        netmask: '255.255.255.0',
                        family: 'IPv4'
                    },
                    {
                        address: '10.168.1.108',
                        netmask: '255.255.255.0',
                        family: 'IPv6'
                    },
                ]
            };
            mySandBox.stub(os, 'networkInterfaces').returns(_interface);
            const result: boolean = ExtensionUtil.checkIfIBMer();
            result.should.equal(false);
        });
    });

    describe('registerCommands', () => {

        before(async () => {
            if (!ExtensionUtil.isActive()) {
                await ExtensionUtil.activateExtension();
            }
        });

        it('should check all the commands are registered', async () => {
            const allCommands: Array<string> = await vscode.commands.getCommands();

            const commands: Array<string> = allCommands.filter((command: string) => {
                if (command.endsWith('.focus') || command.endsWith('.resetViewLocation') || command.endsWith('.toggleVisibility') || command.endsWith('.removeView')) {
                    // VSCode creates commands for tree views, so ignore those.
                    return false;
                }
                return command.startsWith('gatewaysExplorer') || command.startsWith('aPackagesExplorer') || command.startsWith('environmentExplorer') || command.startsWith('extensionHome') || command.startsWith('walletExplorer') || command.startsWith('preReq') || command.startsWith('releaseNotes');
            });

            commands.should.deep.equal([
                ExtensionCommands.REFRESH_GATEWAYS,
                ExtensionCommands.CONNECT_TO_GATEWAY,
                ExtensionCommands.DISCONNECT_GATEWAY,
                ExtensionCommands.ADD_GATEWAY,
                ExtensionCommands.DELETE_GATEWAY,
                ExtensionCommands.ADD_WALLET_IDENTITY,
                ExtensionCommands.CREATE_SMART_CONTRACT_PROJECT,
                ExtensionCommands.PACKAGE_SMART_CONTRACT,
                ExtensionCommands.REFRESH_PACKAGES,
                ExtensionCommands.REFRESH_ENVIRONMENTS,
                ExtensionCommands.START_FABRIC,
                ExtensionCommands.START_FABRIC_SHORT,
                ExtensionCommands.STOP_FABRIC_SHORT,
                ExtensionCommands.STOP_FABRIC,
                ExtensionCommands.RESTART_FABRIC,
                ExtensionCommands.RESTART_FABRIC_SHORT,
                ExtensionCommands.TEARDOWN_FABRIC_SHORT,
                ExtensionCommands.EXPORT_CONNECTION_PROFILE,
                ExtensionCommands.EXPORT_CONNECTION_PROFILE_CONNECTED,
                ExtensionCommands.DELETE_SMART_CONTRACT,
                ExtensionCommands.EXPORT_SMART_CONTRACT,
                ExtensionCommands.IMPORT_SMART_CONTRACT,
                ExtensionCommands.VIEW_PACKAGE_INFORMATION,
                ExtensionCommands.ADD_ENVIRONMENT,
                ExtensionCommands.DELETE_ENVIRONMENT_SHORT,
                ExtensionCommands.ASSOCIATE_IDENTITY_NODE,
                ExtensionCommands.IMPORT_NODES_TO_ENVIRONMENT,
                ExtensionCommands.EDIT_NODE_FILTERS,
                ExtensionCommands.REPLACE_ASSOCIATED_IDENTITY,
                ExtensionCommands.DELETE_NODE,
                ExtensionCommands.HIDE_NODE,
                ExtensionCommands.CONNECT_TO_ENVIRONMENT,
                ExtensionCommands.DISCONNECT_ENVIRONMENT,
                ExtensionCommands.INSTALL_SMART_CONTRACT,
                ExtensionCommands.INSTANTIATE_SMART_CONTRACT,
                ExtensionCommands.APPROVE_SMART_CONTRACT,
                ExtensionCommands.COMMIT_SMART_CONTRACT,
                ExtensionCommands.DEPLOY_SMART_CONTRACT,
                ExtensionCommands.TEST_ALL_SMART_CONTRACT,
                ExtensionCommands.TEST_SMART_CONTRACT,
                ExtensionCommands.SUBMIT_TRANSACTION,
                ExtensionCommands.EVALUATE_TRANSACTION,
                ExtensionCommands.UPGRADE_SMART_CONTRACT,
                ExtensionCommands.CREATE_NEW_IDENTITY,
                ExtensionCommands.REFRESH_WALLETS,
                ExtensionCommands.ADD_WALLET,
                ExtensionCommands.REMOVE_WALLET,
                ExtensionCommands.DELETE_IDENTITY,
                ExtensionCommands.ASSOCIATE_WALLET,
                ExtensionCommands.DISSOCIATE_WALLET,
                ExtensionCommands.EXPORT_WALLET,
                ExtensionCommands.ASSOCIATE_TRANSACTION_DATA_DIRECTORY,
                ExtensionCommands.DISSOCIATE_TRANSACTION_DATA_DIRECTORY,
                ExtensionCommands.SUBSCRIBE_TO_EVENT,
                ExtensionCommands.EXPORT_APP_DATA,
                ExtensionCommands.LOG_IN_AND_DISCOVER,
                ExtensionCommands.OPEN_CONSOLE_IN_BROWSER,
                ExtensionCommands.OPEN_COUCHDB_IN_BROWSER,
                ExtensionCommands.OPEN_HOME_PAGE,
                ExtensionCommands.OPEN_PRE_REQ_PAGE,
                ExtensionCommands.OPEN_RELEASE_NOTES,
                ExtensionCommands.DELETE_ENVIRONMENT,
                ExtensionCommands.TEARDOWN_FABRIC
            ]);
        });

        it('should check the activation events are correct', async () => {
            const packageJSON: any = ExtensionUtil.getPackageJSON();
            const activationEvents: string[] = packageJSON.activationEvents;

            activationEvents.should.deep.equal([
                `onView:gatewayExplorer`,
                `onView:environmentExplorer`,
                `onView:aPackagesExplorer`,
                `onView:walletExplorer`,
                `onCommand:${ExtensionCommands.ADD_GATEWAY}`,
                `onCommand:${ExtensionCommands.DELETE_GATEWAY}`,
                `onCommand:${ExtensionCommands.CONNECT_TO_GATEWAY}`,
                `onCommand:${ExtensionCommands.DISCONNECT_GATEWAY}`,
                `onCommand:${ExtensionCommands.REFRESH_GATEWAYS}`,
                `onCommand:${ExtensionCommands.TEST_SMART_CONTRACT}`,
                `onCommand:${ExtensionCommands.TEST_ALL_SMART_CONTRACT}`,
                `onCommand:${ExtensionCommands.ASSOCIATE_WALLET}`,
                `onCommand:${ExtensionCommands.DISSOCIATE_WALLET}`,
                `onCommand:${ExtensionCommands.EXPORT_CONNECTION_PROFILE}`,
                `onCommand:${ExtensionCommands.EXPORT_CONNECTION_PROFILE_CONNECTED}`,
                `onCommand:${ExtensionCommands.CREATE_SMART_CONTRACT_PROJECT}`,
                `onCommand:${ExtensionCommands.PACKAGE_SMART_CONTRACT}`,
                `onCommand:${ExtensionCommands.DELETE_SMART_CONTRACT}`,
                `onCommand:${ExtensionCommands.EXPORT_SMART_CONTRACT}`,
                `onCommand:${ExtensionCommands.IMPORT_SMART_CONTRACT}`,
                `onCommand:${ExtensionCommands.REFRESH_PACKAGES}`,
                `onCommand:${ExtensionCommands.VIEW_PACKAGE_INFORMATION}`,
                `onCommand:${ExtensionCommands.ADD_ENVIRONMENT}`,
                `onCommand:${ExtensionCommands.IMPORT_NODES_TO_ENVIRONMENT}`,
                `onCommand:${ExtensionCommands.DELETE_ENVIRONMENT}`,
                `onCommand:${ExtensionCommands.DELETE_ENVIRONMENT_SHORT}`,
                `onCommand:${ExtensionCommands.ASSOCIATE_IDENTITY_NODE}`,
                `onCommand:${ExtensionCommands.REPLACE_ASSOCIATED_IDENTITY}`,
                `onCommand:${ExtensionCommands.DELETE_NODE}`,
                `onCommand:${ExtensionCommands.CONNECT_TO_ENVIRONMENT}`,
                `onCommand:${ExtensionCommands.DISCONNECT_ENVIRONMENT}`,
                `onCommand:${ExtensionCommands.INSTALL_SMART_CONTRACT}`,
                `onCommand:${ExtensionCommands.APPROVE_SMART_CONTRACT}`,
                `onCommand:${ExtensionCommands.COMMIT_SMART_CONTRACT}`,
                `onCommand:${ExtensionCommands.DEPLOY_SMART_CONTRACT}`,
                `onCommand:${ExtensionCommands.INSTANTIATE_SMART_CONTRACT}`,
                `onCommand:${ExtensionCommands.REFRESH_ENVIRONMENTS}`,
                `onCommand:${ExtensionCommands.START_FABRIC}`,
                `onCommand:${ExtensionCommands.START_FABRIC_SHORT}`,
                `onCommand:${ExtensionCommands.STOP_FABRIC}`,
                `onCommand:${ExtensionCommands.STOP_FABRIC_SHORT}`,
                `onCommand:${ExtensionCommands.RESTART_FABRIC}`,
                `onCommand:${ExtensionCommands.RESTART_FABRIC_SHORT}`,
                `onCommand:${ExtensionCommands.TEARDOWN_FABRIC}`,
                `onCommand:${ExtensionCommands.TEARDOWN_FABRIC_SHORT}`,
                `onCommand:${ExtensionCommands.UPGRADE_SMART_CONTRACT}`,
                `onCommand:${ExtensionCommands.CREATE_NEW_IDENTITY}`,
                `onCommand:${ExtensionCommands.OPEN_CONSOLE_IN_BROWSER}`,
                `onCommand:${ExtensionCommands.OPEN_COUCHDB_IN_BROWSER}`,
                `onCommand:${ExtensionCommands.REFRESH_WALLETS}`,
                `onCommand:${ExtensionCommands.ADD_WALLET}`,
                `onCommand:${ExtensionCommands.ADD_WALLET_IDENTITY}`,
                `onCommand:${ExtensionCommands.REMOVE_WALLET}`,
                `onCommand:${ExtensionCommands.DELETE_IDENTITY}`,
                `onCommand:${ExtensionCommands.EXPORT_WALLET}`,
                `onCommand:${ExtensionCommands.ASSOCIATE_TRANSACTION_DATA_DIRECTORY}`,
                `onCommand:${ExtensionCommands.DISSOCIATE_TRANSACTION_DATA_DIRECTORY}`,
                `onCommand:${ExtensionCommands.SUBSCRIBE_TO_EVENT}`,
                `onCommand:${ExtensionCommands.EXPORT_APP_DATA}`,
                `onCommand:${ExtensionCommands.OPEN_HOME_PAGE}`,
                `onCommand:${ExtensionCommands.OPEN_PRE_REQ_PAGE}`,
                `onCommand:${ExtensionCommands.OPEN_RELEASE_NOTES}`,
                `onCommand:${ExtensionCommands.OPEN_SAMPLE_GALLERY}`,
                `onCommand:${ExtensionCommands.OPEN_TUTORIAL_GALLERY}`,
                `onCommand:${ExtensionCommands.OPEN_DEPLOY_PAGE}`,
                `onCommand:${ExtensionCommands.OPEN_TRANSACTION_PAGE}`,
                `onCommand:${ExtensionCommands.SAVE_TUTORIAL_AS_PDF}`,
                `onCommand:${ExtensionCommands.MANAGE_FEATURE_FLAGS}`,
                `onCommand:${ExtensionCommands.DELETE_DIRECTORY}`,
                `onDebug`
            ]);
        });

        it('should register commands', async () => {
            const disposeExtensionSpy: sinon.SinonSpy = mySandBox.spy(ExtensionUtil, 'disposeExtension');

            const ctx: vscode.ExtensionContext = GlobalState.getExtensionContext();
            const registerPreActivationCommandsStub: sinon.SinonStub = mySandBox.stub(ExtensionUtil, 'registerPreActivationCommands').resolves(ctx);

            await ExtensionUtil.registerCommands(ctx);

            disposeExtensionSpy.should.have.been.calledOnceWith(ctx);
            registerPreActivationCommandsStub.should.have.been.calledOnce;
        });

        it('should register and show home page', async () => {
            const homeViewStub: sinon.SinonStub = mySandBox.stub(HomeView.prototype, 'openView');
            homeViewStub.resolves();

            const ctx: vscode.ExtensionContext = GlobalState.getExtensionContext();
            const registerPreActivationCommandsStub: sinon.SinonStub = mySandBox.stub(ExtensionUtil, 'registerPreActivationCommands').resolves(ctx);

            await ExtensionUtil.registerCommands(ctx);

            await vscode.commands.executeCommand(ExtensionCommands.OPEN_HOME_PAGE);

            registerPreActivationCommandsStub.should.have.been.calledOnce;
            homeViewStub.should.have.been.calledOnce;
        });

        it('should register and show fabric 2 page', async () => {
            const fabric2ViewStub: sinon.SinonStub = mySandBox.stub(Fabric2View.prototype, 'openView');
            fabric2ViewStub.resolves();

            const ctx: vscode.ExtensionContext = GlobalState.getExtensionContext();
            const registerPreActivationCommandsStub: sinon.SinonStub = mySandBox.stub(ExtensionUtil, 'registerPreActivationCommands').resolves(ctx);

            await ExtensionUtil.registerCommands(ctx);

            await vscode.commands.executeCommand(ExtensionCommands.OPEN_FABRIC_2_PAGE);

            registerPreActivationCommandsStub.should.have.been.calledOnce;
            fabric2ViewStub.should.have.been.calledOnce;
        });

        it('should register and show tutorial gallery', async () => {
            const TutorialGalleryViewStub: sinon.SinonStub = mySandBox.stub(TutorialGalleryView.prototype, 'openView');
            TutorialGalleryViewStub.resolves();

            const ctx: vscode.ExtensionContext = GlobalState.getExtensionContext();
            const registerPreActivationCommandsStub: sinon.SinonStub = mySandBox.stub(ExtensionUtil, 'registerPreActivationCommands').resolves(ctx);

            await ExtensionUtil.registerCommands(ctx);

            await vscode.commands.executeCommand(ExtensionCommands.OPEN_TUTORIAL_GALLERY);

            registerPreActivationCommandsStub.should.have.been.calledOnce;
            TutorialGalleryViewStub.should.have.been.calledOnce;
        });

        it('should register and show sample gallery', async () => {
            const sampleGalleryViewStub: sinon.SinonStub = mySandBox.stub(SampleGalleryView.prototype, 'openView');
            sampleGalleryViewStub.resolves();

            const ctx: vscode.ExtensionContext = GlobalState.getExtensionContext();
            const registerPreActivationCommandsStub: sinon.SinonStub = mySandBox.stub(ExtensionUtil, 'registerPreActivationCommands').resolves(ctx);

            await ExtensionUtil.registerCommands(ctx);

            await vscode.commands.executeCommand(ExtensionCommands.OPEN_SAMPLE_GALLERY);

            registerPreActivationCommandsStub.should.have.been.calledOnce;
            sampleGalleryViewStub.should.have.been.calledOnce;
        });

        it('should register and show transaction page', async () => {
            const openTransactionViewStub: sinon.SinonStub = mySandBox.stub(openTransactionViewCommand, 'openTransactionView');
            openTransactionViewStub.resolves();

            const ctx: vscode.ExtensionContext = GlobalState.getExtensionContext();

            await ExtensionUtil.registerCommands(ctx);
            await vscode.commands.executeCommand(ExtensionCommands.OPEN_TRANSACTION_PAGE);

            openTransactionViewStub.should.have.been.calledOnce;
        });

        it('should register and show tutorial page', async () => {
            const TutorialViewStub: sinon.SinonStub = mySandBox.stub(TutorialView.prototype, 'openView');
            TutorialViewStub.resolves();

            const ctx: vscode.ExtensionContext = GlobalState.getExtensionContext();
            const registerPreActivationCommandsStub: sinon.SinonStub = mySandBox.stub(ExtensionUtil, 'registerPreActivationCommands').resolves(ctx);

            await ExtensionUtil.registerCommands(ctx);

            await vscode.commands.executeCommand(ExtensionCommands.OPEN_TUTORIAL_PAGE, 'IBMCode/Code-Tutorials', 'Developing smart contracts with IBM Blockchain VSCode Extension');

            registerPreActivationCommandsStub.should.have.been.calledOnce;
            TutorialViewStub.should.have.been.calledOnce;
        });

        it('should register and show sample page', async () => {
            const sampleViewStub: sinon.SinonStub = mySandBox.stub(SampleView.prototype, 'openView');
            sampleViewStub.resolves();

            const ctx: vscode.ExtensionContext = GlobalState.getExtensionContext();
            const registerPreActivationCommandsStub: sinon.SinonStub = mySandBox.stub(ExtensionUtil, 'registerPreActivationCommands').resolves(ctx);

            await ExtensionUtil.registerCommands(ctx);

            await vscode.commands.executeCommand(ExtensionCommands.OPEN_SAMPLE_PAGE, 'hyperledger/fabric-samples', 'FabCar');

            registerPreActivationCommandsStub.should.have.been.calledOnce;
            sampleViewStub.should.have.been.calledOnce;
        });

        it('should register and open create new instance link', async () => {
            const executeCommandStub: sinon.SinonStub = mySandBox.stub(vscode.commands, 'executeCommand').callThrough();
            executeCommandStub.withArgs('vscode.open').resolves();
            const sendTelemetryEventStub: sinon.SinonStub = mySandBox.stub(Reporter.instance(), 'sendTelemetryEvent');

            const ctx: vscode.ExtensionContext = GlobalState.getExtensionContext();
            const registerPreActivationCommandsStub: sinon.SinonStub = mySandBox.stub(ExtensionUtil, 'registerPreActivationCommands').resolves(ctx);

            await ExtensionUtil.registerCommands(ctx);

            await vscode.commands.executeCommand(ExtensionCommands.OPEN_NEW_INSTANCE_LINK);

            registerPreActivationCommandsStub.should.have.been.calledOnce;
            executeCommandStub.should.have.been.calledWith('vscode.open', vscode.Uri.parse('https://cloud.ibm.com/catalog/services/blockchain-platform'));
            sendTelemetryEventStub.should.have.been.calledOnceWithExactly('openNewInstanceLink');
        });

        it('should register and open a resource file', async () => {
            const executeCommandStub: sinon.SinonStub = mySandBox.stub(vscode.commands, 'executeCommand').callThrough();
            executeCommandStub.withArgs('vscode.open').resolves();

            const ctx: vscode.ExtensionContext = GlobalState.getExtensionContext();
            const registerPreActivationCommandsStub: sinon.SinonStub = mySandBox.stub(ExtensionUtil, 'registerPreActivationCommands').resolves(ctx);

            await ExtensionUtil.registerCommands(ctx);

            await vscode.commands.executeCommand(ExtensionCommands.OPEN_RESOURCE_FILE, 'URL');

            const url: string = path.join(ExtensionUtil.getExtensionPath(), 'URL');

            registerPreActivationCommandsStub.should.have.been.calledOnce;
            executeCommandStub.should.have.been.calledWith('vscode.open', vscode.Uri.parse(url));
        });

        it('should register and open ibm cloud account extension link if no url provided', async () => {
            const executeCommandStub: sinon.SinonStub = mySandBox.stub(vscode.commands, 'executeCommand').callThrough();
            executeCommandStub.withArgs('vscode.open').resolves();

            const ctx: vscode.ExtensionContext = GlobalState.getExtensionContext();
            const registerPreActivationCommandsStub: sinon.SinonStub = mySandBox.stub(ExtensionUtil, 'registerPreActivationCommands').resolves(ctx);

            await ExtensionUtil.registerCommands(ctx);

            await vscode.commands.executeCommand(ExtensionCommands.OPEN_VSCODE_EXTENSION);

            registerPreActivationCommandsStub.should.have.been.calledOnce;
            executeCommandStub.should.have.been.calledWith('vscode.open', vscode.Uri.parse(defaultDependencies.optional.ibmCloudAccountExtension.url));
        });

        it('should register and open an extension link when url provided', async () => {
            const executeCommandStub: sinon.SinonStub = mySandBox.stub(vscode.commands, 'executeCommand').callThrough();
            executeCommandStub.withArgs('vscode.open').resolves();
            const someExtensionUrl: string = 'vscode:extension/someExtension';

            const ctx: vscode.ExtensionContext = GlobalState.getExtensionContext();
            const registerPreActivationCommandsStub: sinon.SinonStub = mySandBox.stub(ExtensionUtil, 'registerPreActivationCommands').resolves(ctx);

            await ExtensionUtil.registerCommands(ctx);

            await vscode.commands.executeCommand(ExtensionCommands.OPEN_VSCODE_EXTENSION, someExtensionUrl);

            registerPreActivationCommandsStub.should.have.been.calledOnce;
            executeCommandStub.should.have.been.calledWith('vscode.open', vscode.Uri.parse(someExtensionUrl));
        });

        // it('should reload blockchain explorer when debug event emitted', async () => {
        //     await vscode.workspace.getConfiguration().update(SettingConfigurations.HOME_SHOW_ON_STARTUP, false, vscode.ConfigurationTarget.Global);

        //     const session: any = {
        //         some: 'thing',
        //         configuration: {
        //             env: {},
        //             debugEvent: FabricDebugConfigurationProvider.debugEvent
        //         }
        //     };
        //     mySandBox.stub(vscode.debug, 'onDidChangeActiveDebugSession').yields(session as vscode.DebugSession);
        //     const executeCommand: sinon.SinonSpy = mySandBox.spy(vscode.commands, 'executeCommand');
        //     const ctx: vscode.ExtensionContext = GlobalState.getExtensionContext();

        //     const registerPreActivationCommandsStub: sinon.SinonStub = mySandBox.stub(ExtensionUtil, 'registerPreActivationCommands').resolves(ctx);

        //     await ExtensionUtil.registerCommands(ctx);

        //     registerPreActivationCommandsStub.should.have.been.calledOnce;

        //     executeCommand.should.have.been.calledOnce;
        //     executeCommand.should.have.been.calledOnceWith('setContext', 'blockchain-debug', true);
        // });

        // it('should call instantiate if not instantiated', async () => {
        //     await vscode.workspace.getConfiguration().update(SettingConfigurations.HOME_SHOW_ON_STARTUP, false, vscode.ConfigurationTarget.Global);
        //     mySandBox.stub(vscode.commands, 'registerCommand');
        //     const executeCommand: sinon.SinonStub = mySandBox.stub(vscode.commands, 'executeCommand');
        //     const ctx: vscode.ExtensionContext = GlobalState.getExtensionContext();

        //     const registerPreActivationCommandsStub: sinon.SinonStub = mySandBox.stub(ExtensionUtil, 'registerPreActivationCommands').resolves(ctx);

        //     mySandBox.stub(FabricDebugConfigurationProvider, 'getInstantiatedChaincode').resolves();

        //     const session: any = {
        //         some: 'thing',
        //         configuration: {
        //             env: {
        //                 CORE_CHAINCODE_ID_NAME: 'myContract:0.0.1'
        //             },
        //             debugEvent: FabricDebugConfigurationProvider.debugEvent
        //         }
        //     };

        //     const promises: any[] = [];
        //     const onDidChangeActiveDebugSessionStub: sinon.SinonStub = mySandBox.stub(vscode.debug, 'onDidChangeActiveDebugSession');

        //     promises.push(new Promise((resolve: any): void => {
        //         onDidChangeActiveDebugSessionStub.callsFake(async (callback: any) => {
        //             await callback(session as vscode.DebugSession);
        //             resolve();
        //         });

        //     }));

        //     await ExtensionUtil.registerCommands(ctx);
        //     await Promise.all(promises);

        //     registerPreActivationCommandsStub.should.have.been.calledOnce;

        //     executeCommand.should.have.been.calledThrice;
        //     executeCommand.should.have.been.calledWithExactly('setContext', 'blockchain-debug', true);
        //     executeCommand.should.have.been.calledWithExactly(ExtensionCommands.REFRESH_GATEWAYS);
        //     executeCommand.should.have.been.calledWith(ExtensionCommands.DEBUG_COMMAND_LIST, ExtensionCommands.INSTANTIATE_SMART_CONTRACT);
        // });

        // it('should call upgrade if version different', async () => {
        //     await vscode.workspace.getConfiguration().update(SettingConfigurations.HOME_SHOW_ON_STARTUP, false, vscode.ConfigurationTarget.Global);

        //     mySandBox.stub(FabricDebugConfigurationProvider, 'getInstantiatedChaincode').resolves({
        //         name: 'myContract',
        //         version: 'differnet'
        //     });

        //     const session: any = {
        //         some: 'thing',
        //         configuration: {
        //             env: {
        //                 CORE_CHAINCODE_ID_NAME: 'myContract:0.0.1'
        //             },
        //             debugEvent: FabricDebugConfigurationProvider.debugEvent
        //         }
        //     };

        //     const executeCommand: sinon.SinonStub = mySandBox.stub(vscode.commands, 'executeCommand');
        //     const ctx: vscode.ExtensionContext = GlobalState.getExtensionContext();

        //     const registerPreActivationCommandsStub: sinon.SinonStub = mySandBox.stub(ExtensionUtil, 'registerPreActivationCommands').resolves(ctx);

        //     const promises: any[] = [];
        //     const onDidChangeActiveDebugSessionStub: sinon.SinonStub = mySandBox.stub(vscode.debug, 'onDidChangeActiveDebugSession');

        //     promises.push(new Promise((resolve: any): void => {
        //         onDidChangeActiveDebugSessionStub.callsFake(async (callback: any) => {
        //             await callback(session as vscode.DebugSession);
        //             resolve();
        //         });

        //     }));

        //     await ExtensionUtil.registerCommands(ctx);
        //     await Promise.all(promises);

        //     registerPreActivationCommandsStub.should.have.been.calledOnce;

        //     executeCommand.should.have.been.calledThrice;
        //     executeCommand.should.have.been.calledWithExactly('setContext', 'blockchain-debug', true);
        //     executeCommand.should.have.been.calledWithExactly(ExtensionCommands.REFRESH_GATEWAYS);
        //     executeCommand.should.have.been.calledWith(ExtensionCommands.DEBUG_COMMAND_LIST, ExtensionCommands.UPGRADE_SMART_CONTRACT);
        // });

        // it('should not call anything if version same', async () => {
        //     await vscode.workspace.getConfiguration().update(SettingConfigurations.HOME_SHOW_ON_STARTUP, false, vscode.ConfigurationTarget.Global);

        //     mySandBox.stub(FabricDebugConfigurationProvider, 'getInstantiatedChaincode').resolves({
        //         name: 'myContract',
        //         version: '0.0.1'
        //     });

        //     const session: any = {
        //         some: 'thing',
        //         configuration: {
        //             env: {
        //                 CORE_CHAINCODE_ID_NAME: 'myContract:0.0.1'
        //             },
        //             debugEvent: FabricDebugConfigurationProvider.debugEvent
        //         }
        //     };
        //     mySandBox.stub(vscode.debug, 'onDidChangeActiveDebugSession').yields(session as vscode.DebugSession);
        //     const executeCommand: sinon.SinonStub = mySandBox.stub(vscode.commands, 'executeCommand');

        //     const ctx: vscode.ExtensionContext = GlobalState.getExtensionContext();
        //     const registerPreActivationCommandsStub: sinon.SinonStub = mySandBox.stub(ExtensionUtil, 'registerPreActivationCommands').resolves(ctx);

        //     await ExtensionUtil.registerCommands(ctx);

        //     registerPreActivationCommandsStub.should.have.been.calledOnce;

        //     executeCommand.should.have.been.calledTwice;
        //     executeCommand.should.have.been.calledWithExactly('setContext', 'blockchain-debug', true);
        //     executeCommand.should.have.been.calledWithExactly(ExtensionCommands.REFRESH_GATEWAYS);
        //     executeCommand.should.not.have.been.calledWith(ExtensionCommands.DEBUG_COMMAND_LIST);
        // });

        // it('should set blockchain-debug false when no debug session', async () => {
        //     await vscode.workspace.getConfiguration().update(SettingConfigurations.HOME_SHOW_ON_STARTUP, false, vscode.ConfigurationTarget.Global);

        //     const session: any = undefined;
        //     mySandBox.stub(vscode.debug, 'onDidChangeActiveDebugSession').yields(session as vscode.DebugSession);
        //     const executeCommand: sinon.SinonSpy = mySandBox.spy(vscode.commands, 'executeCommand');
        //     const ctx: vscode.ExtensionContext = GlobalState.getExtensionContext();

        //     const registerPreActivationCommandsStub: sinon.SinonStub = mySandBox.stub(ExtensionUtil, 'registerPreActivationCommands').resolves(ctx);

        //     await ExtensionUtil.registerCommands(ctx);

        //     registerPreActivationCommandsStub.should.have.been.calledOnce;

        //     executeCommand.should.have.been.calledOnceWith('setContext', 'blockchain-debug', false);
        // });

        // it('should set blockchain-debug to false when starting a debug event other than for smart contrcts', async () => {
        //     await vscode.workspace.getConfiguration().update(SettingConfigurations.HOME_SHOW_ON_STARTUP, false, vscode.ConfigurationTarget.Global);
        //     const session: any = {
        //         some: 'thing'
        //     };
        //     mySandBox.stub(vscode.debug, 'onDidChangeActiveDebugSession').yields(session as vscode.DebugSession);
        //     const executeCommand: sinon.SinonSpy = mySandBox.spy(vscode.commands, 'executeCommand');
        //     const ctx: vscode.ExtensionContext = GlobalState.getExtensionContext();

        //     const registerPreActivationCommandsStub: sinon.SinonStub = mySandBox.stub(ExtensionUtil, 'registerPreActivationCommands').resolves(ctx);

        //     await ExtensionUtil.registerCommands(ctx);

        //     registerPreActivationCommandsStub.should.have.been.calledOnce;

        //     executeCommand.should.have.been.calledOnceWith('setContext', 'blockchain-debug', false);
        // });

        // it('should set blockchain-debug to false when debugEvent property is missing', async () => {
        //     await vscode.workspace.getConfiguration().update(SettingConfigurations.HOME_SHOW_ON_STARTUP, false, vscode.ConfigurationTarget.Global);
        //     const session: any = {
        //         some: 'thing',
        //         configuration: {
        //             something: 'else'
        //         }
        //     };
        //     mySandBox.stub(vscode.debug, 'onDidChangeActiveDebugSession').yields(session as vscode.DebugSession);
        //     const executeCommand: sinon.SinonSpy = mySandBox.spy(vscode.commands, 'executeCommand');
        //     const ctx: vscode.ExtensionContext = GlobalState.getExtensionContext();

        //     const registerPreActivationCommandsStub: sinon.SinonStub = mySandBox.stub(ExtensionUtil, 'registerPreActivationCommands').resolves(ctx);

        //     await ExtensionUtil.registerCommands(ctx);

        //     registerPreActivationCommandsStub.should.have.been.calledOnce;

        //     executeCommand.should.have.been.calledOnceWith('setContext', 'blockchain-debug', false);
        // });

        it('should push the reporter instance if production flag is true', async () => {
            mySandBox.stub(vscode.commands, 'executeCommand').resolves();

            mySandBox.stub(ExtensionUtil, 'getPackageJSON').returns({ production: true });
            const reporterStub: sinon.SinonStub = mySandBox.stub(Reporter, 'instance');

            const ctx: vscode.ExtensionContext = GlobalState.getExtensionContext();

            const registerPreActivationCommandsStub: sinon.SinonStub = mySandBox.stub(ExtensionUtil, 'registerPreActivationCommands').resolves(ctx);

            await ExtensionUtil.registerCommands(ctx);

            registerPreActivationCommandsStub.should.have.been.calledOnce;

            reporterStub.should.have.been.called;
        });

        it(`shouldn't push the reporter instance if production flag is false`, async () => {
            mySandBox.stub(vscode.commands, 'executeCommand').resolves();

            mySandBox.stub(ExtensionUtil, 'getPackageJSON').returns({ production: false });
            const reporterStub: sinon.SinonStub = mySandBox.stub(Reporter, 'instance');

            const ctx: vscode.ExtensionContext = GlobalState.getExtensionContext();

            const registerPreActivationCommandsStub: sinon.SinonStub = mySandBox.stub(ExtensionUtil, 'registerPreActivationCommands').resolves(ctx);

            await ExtensionUtil.registerCommands(ctx);

            registerPreActivationCommandsStub.should.have.been.calledOnce;

            reporterStub.should.not.have.been.called;
        });

        it('should refresh wallets if they update', async () => {
            const executeCommandSpy: sinon.SinonSpy = mySandBox.spy(vscode.commands, 'executeCommand');

            const walletRegistryEntry: FabricWalletRegistryEntry = new FabricWalletRegistryEntry();
            walletRegistryEntry.name = 'bobsWallet';
            walletRegistryEntry.walletPath = 'myPath';

            await FabricWalletRegistry.instance().add(walletRegistryEntry);

            executeCommandSpy.should.have.been.calledWith(ExtensionCommands.REFRESH_WALLETS);
        });

        it('should add home page button to the status bar', async () => {
            const newContext: vscode.ExtensionContext = GlobalState.getExtensionContext();
            const homePageButton: any = newContext.subscriptions.find((subscription: any) => {
                return subscription.text === 'Blockchain Home';
            });
            homePageButton.tooltip.should.equal('View Homepage');
            homePageButton.command.should.equal(ExtensionCommands.OPEN_HOME_PAGE);
        });
    });

    describe('registerPreActivationCommands', () => {

        it('should register and open PreReq page', async () => {
            const preReqViewStub: sinon.SinonStub = mySandBox.stub(PreReqView.prototype, 'openView');
            preReqViewStub.resolves();

            const ctx: vscode.ExtensionContext = { subscriptions: [] } as vscode.ExtensionContext;
            const registerCommandStub: sinon.SinonStub = mySandBox.stub(vscode.commands, 'registerCommand').withArgs(ExtensionCommands.OPEN_PRE_REQ_PAGE).yields({} as vscode.Command);

            const context: vscode.ExtensionContext = await ExtensionUtil.registerPreActivationCommands(ctx);
            context.subscriptions.length.should.equal(4);
            registerCommandStub.should.have.been.calledOnce;
            preReqViewStub.should.have.been.calledOnce;

        });
    });

    describe('setupCommands', () => {
        let clearExtensionCacheStub: sinon.SinonStub;
        let globalStateGetStub: sinon.SinonStub;
        let setupLocalRuntimeStub: sinon.SinonStub;
        let restoreCommandsStub: sinon.SinonStub;
        let getExtensionContextStub: sinon.SinonStub;
        let registerCommandsStub: sinon.SinonStub;
        let executeStoredCommandsStub: sinon.SinonStub;
        let logSpy: sinon.SinonSpy;
        let getExtensionLocalFabricSettingStub: sinon.SinonStub;
        let fabricConnectionFactorySpy: sinon.SinonSpy;
        let globalStateUpdateSpy: sinon.SinonSpy;

        beforeEach(() => {
            clearExtensionCacheStub = mySandBox.stub(DependencyManager.instance(), 'clearExtensionCache');
            globalStateGetStub = mySandBox.stub(GlobalState, 'get');
            setupLocalRuntimeStub = mySandBox.stub(ExtensionUtil, 'setupLocalRuntime');
            restoreCommandsStub = mySandBox.stub(TemporaryCommandRegistry.instance(), 'restoreCommands');
            getExtensionContextStub = mySandBox.stub(GlobalState, 'getExtensionContext');
            registerCommandsStub = mySandBox.stub(ExtensionUtil, 'registerCommands');
            executeStoredCommandsStub = mySandBox.stub(TemporaryCommandRegistry.instance(), 'executeStoredCommands');
            logSpy = mySandBox.spy(VSCodeBlockchainOutputAdapter.instance(), 'log');
            getExtensionLocalFabricSettingStub = mySandBox.stub(ExtensionUtil, 'getExtensionLocalFabricSetting');
            fabricConnectionFactorySpy = mySandBox.spy(FabricConnectionFactory, 'createFabricWallet');
            globalStateUpdateSpy = mySandBox.spy(GlobalState, 'update');

            clearExtensionCacheStub.resolves();
        });

        afterEach(() => {
            mySandBox.restore();
        });

        it('should not created one org local fabric if it has already been created', async () => {
            globalStateGetStub.returns({
                version: '1.0.0'
            });
            setupLocalRuntimeStub.resolves();
            restoreCommandsStub.resolves();
            getExtensionContextStub.returns({ hello: 'world' });
            registerCommandsStub.resolves();
            executeStoredCommandsStub.resolves();
            getExtensionLocalFabricSettingStub.returns(true);

            const globalState: ExtensionData = GlobalState.get();
            globalState.createOneOrgLocalFabric = false;
            await GlobalState.update(globalState);

            globalStateUpdateSpy.resetHistory();
            globalStateGetStub.resetHistory();

            await ExtensionUtil.setupCommands();

            globalStateUpdateSpy.should.not.have.been.called;

            globalStateGetStub.should.have.been.calledOnce;
            getExtensionLocalFabricSettingStub.should.have.been.calledOnce;
            setupLocalRuntimeStub.should.not.have.been.called;

            logSpy.callCount.should.equal(4);
            logSpy.getCall(0).should.have.been.calledWith(LogType.INFO, undefined, `Clearing extension cache`);
            logSpy.getCall(1).should.have.been.calledWith(LogType.INFO, undefined, 'Restoring command registry');
            logSpy.getCall(2).should.have.been.calledWith(LogType.INFO, undefined, 'Registering commands');
            logSpy.getCall(3).should.have.been.calledWith(LogType.INFO, undefined, 'Execute stored commands in the registry');

            restoreCommandsStub.should.have.been.calledOnce;
            getExtensionContextStub.should.have.been.calledOnce;
            registerCommandsStub.should.have.been.calledOnceWithExactly({ hello: 'world' });
            executeStoredCommandsStub.should.have.been.calledOnce;
            fabricConnectionFactorySpy.should.have.been.called;
            clearExtensionCacheStub.should.have.been.calledOnce;
        });

        it(`should delete local registry entries if not enabled`, async () => {
            await FabricGatewayRegistry.instance().add({
                name: 'otherGateway',
                managedGateway: false,
                associatedWallet: undefined,
                connectionProfilePath: path.join('blockchain', 'extension', 'directory', 'gatewayOne', 'connection.json')
            });

            await TestUtil.startLocalFabric();

            globalStateGetStub.returns({
                version: '1.0.0'
            });
            setupLocalRuntimeStub.resolves();
            restoreCommandsStub.resolves();
            getExtensionContextStub.returns({ hello: 'world' });
            registerCommandsStub.resolves();
            executeStoredCommandsStub.resolves();
            getExtensionLocalFabricSettingStub.returns(false);
            const removeRuntimeStub: sinon.SinonStub = mySandBox.stub(LocalMicroEnvironmentManager.instance(), 'removeRuntime').returns(undefined);
            const deleteEnvironmentSpy: sinon.SinonSpy = mySandBox.spy(FabricEnvironmentRegistry.instance(), 'delete');

            const globalState: ExtensionData = GlobalState.get();
            globalState.createOneOrgLocalFabric = true;
            await GlobalState.update(globalState);

            globalStateUpdateSpy.resetHistory();
            globalStateGetStub.resetHistory();

            await ExtensionUtil.setupCommands();

            globalStateUpdateSpy.should.not.have.been.called;

            globalStateGetStub.should.have.been.calledOnce;
            getExtensionLocalFabricSettingStub.should.have.been.calledOnce;
            setupLocalRuntimeStub.should.not.have.been.calledOnce;

            logSpy.callCount.should.equal(4);
            logSpy.getCall(0).should.have.been.calledWith(LogType.INFO, undefined, `Clearing extension cache`);
            logSpy.getCall(1).should.have.been.calledWith(LogType.INFO, undefined, 'Restoring command registry');
            logSpy.getCall(2).should.have.been.calledWith(LogType.INFO, undefined, 'Registering commands');
            logSpy.getCall(3).should.have.been.calledWith(LogType.INFO, undefined, 'Execute stored commands in the registry');

            restoreCommandsStub.should.have.been.calledOnce;
            getExtensionContextStub.should.have.been.calledOnce;
            registerCommandsStub.should.have.been.calledOnceWithExactly({ hello: 'world' });
            executeStoredCommandsStub.should.have.been.calledOnce;
            fabricConnectionFactorySpy.should.have.been.called;

            deleteEnvironmentSpy.should.have.been.calledOnceWithExactly(FabricRuntimeUtil.LOCAL_FABRIC, true);
            removeRuntimeStub.should.have.been.calledOnceWithExactly(FabricRuntimeUtil.LOCAL_FABRIC);
            clearExtensionCacheStub.should.have.been.calledOnce;
        });
    });

    describe('completeActivation', () => {
        let logSpy: sinon.SinonSpy;
        let globalStateGetStub: sinon.SinonStub;
        let executeCommandStub: sinon.SinonStub;
        let showConfirmationWarningMessageStub: sinon.SinonStub;
        let mockRuntime: sinon.SinonStubbedInstance<LocalMicroEnvironment>;
        let globalStateUpdateStub: sinon.SinonStub;
        let ensureRuntimeStub: sinon.SinonStub;
        const runtimeManager: LocalMicroEnvironmentManager = LocalMicroEnvironmentManager.instance();
        beforeEach(async () => {
            mySandBox.restore();
            await FabricEnvironmentRegistry.instance().clear();
            await TestUtil.startLocalFabric();

            logSpy = mySandBox.spy(VSCodeBlockchainOutputAdapter.instance(), 'log');
            globalStateGetStub = mySandBox.stub(GlobalState, 'get');
            executeCommandStub = mySandBox.stub(vscode.commands, 'executeCommand');

            showConfirmationWarningMessageStub = mySandBox.stub(UserInputUtil, 'showConfirmationWarningMessage');
            mockRuntime = mySandBox.createStubInstance(LocalMicroEnvironment);
            mockRuntime.getName.returns(FabricRuntimeUtil.LOCAL_FABRIC);

            ensureRuntimeStub = mySandBox.stub(runtimeManager, 'ensureRuntime').returns(undefined);
            ensureRuntimeStub.withArgs(FabricRuntimeUtil.LOCAL_FABRIC, undefined, 1).resolves(mockRuntime);
            globalStateUpdateStub = mySandBox.stub(GlobalState, 'update');
        });

        it(`shouldn't open home page if disabled in user settings`, async () => {
            await vscode.workspace.getConfiguration().update(SettingConfigurations.HOME_SHOW_ON_STARTUP, false, vscode.ConfigurationTarget.Global);

            globalStateGetStub.returns({
                version: '0.0.1',
                generatorVersion: dependencies['generator-fabric']
            });

            executeCommandStub.resolves();

            await ExtensionUtil.completeActivation();

            logSpy.should.have.been.calledWith(LogType.INFO, 'IBM Blockchain Platform Extension activated');
            executeCommandStub.should.not.have.been.calledWith(ExtensionCommands.OPEN_HOME_PAGE);
            globalStateUpdateStub.should.not.have.been.called;
        });

        it(`should open home page if enabled in user settings and extension has updated`, async () => {
            await vscode.workspace.getConfiguration().update(SettingConfigurations.HOME_SHOW_ON_STARTUP, true, vscode.ConfigurationTarget.Global);

            globalStateGetStub.returns({
                generatorVersion: dependencies['generator-fabric']
            });

            executeCommandStub.resolves();

            await ExtensionUtil.completeActivation(true);

            logSpy.should.have.been.calledWith(LogType.INFO, 'IBM Blockchain Platform Extension activated');
            executeCommandStub.should.have.been.calledWith(ExtensionCommands.OPEN_HOME_PAGE);
            globalStateUpdateStub.should.not.have.been.called;
        });

        it(`should open home page if enabled in user settings, extension has updated and user selected show next setting - the latter should be set to false after`, async () => {
            await vscode.workspace.getConfiguration().update(SettingConfigurations.HOME_SHOW_ON_STARTUP, true, vscode.ConfigurationTarget.Global);
            await vscode.workspace.getConfiguration().update(SettingConfigurations.HOME_SHOW_ON_NEXT_ACTIVATION, true, vscode.ConfigurationTarget.Global);

            globalStateGetStub.returns({
                generatorVersion: dependencies['generator-fabric']
            });

            executeCommandStub.resolves();

            await ExtensionUtil.completeActivation(true);

            logSpy.should.have.been.calledWith(LogType.INFO, 'IBM Blockchain Platform Extension activated');
            executeCommandStub.should.have.been.calledWith(ExtensionCommands.OPEN_HOME_PAGE);
            globalStateUpdateStub.should.not.have.been.called;
            const showOnNext: boolean = await vscode.workspace.getConfiguration().get(SettingConfigurations.HOME_SHOW_ON_NEXT_ACTIVATION);
            showOnNext.should.be.false;
        });

        it(`should open home page on first activation`, async () => {
            await vscode.workspace.getConfiguration().update(SettingConfigurations.HOME_SHOW_ON_STARTUP, true, vscode.ConfigurationTarget.Global);

            globalStateGetStub.returns({
                version: '5.0.0',
                generatorVersion: dependencies['generator-fabric']
            });

            executeCommandStub.resolves();

            await ExtensionUtil.completeActivation();

            logSpy.should.have.been.calledWith(LogType.INFO, 'IBM Blockchain Platform Extension activated');
            executeCommandStub.should.have.been.calledWith(ExtensionCommands.OPEN_HOME_PAGE);
            globalStateUpdateStub.should.not.have.been.called;
        });

        it(`shouldn't open home page on second activation`, async () => {
            await vscode.workspace.getConfiguration().update(SettingConfigurations.HOME_SHOW_ON_STARTUP, true, vscode.ConfigurationTarget.Global);

            globalStateGetStub.returns({
                version: currentExtensionVersion,
                generatorVersion: dependencies['generator-fabric']
            });

            executeCommandStub.resolves();

            await ExtensionUtil.completeActivation();

            logSpy.should.have.been.calledWith(LogType.INFO, null, 'IBM Blockchain Platform Extension activated');
            executeCommandStub.should.not.have.been.calledWith(ExtensionCommands.OPEN_HOME_PAGE);
            globalStateUpdateStub.should.not.have.been.called;
        });

        it(`should open home page if user selects show on next activation setting, and setting should be set to false after`, async () => {
            await vscode.workspace.getConfiguration().update(SettingConfigurations.HOME_SHOW_ON_STARTUP, false, vscode.ConfigurationTarget.Global);
            await vscode.workspace.getConfiguration().update(SettingConfigurations.HOME_SHOW_ON_NEXT_ACTIVATION, true, vscode.ConfigurationTarget.Global);

            globalStateGetStub.returns({
                generatorVersion: dependencies['generator-fabric']
            });

            executeCommandStub.resolves();

            await ExtensionUtil.completeActivation(true);

            logSpy.should.have.been.calledWith(LogType.INFO, 'IBM Blockchain Platform Extension activated');
            executeCommandStub.should.have.been.calledWith(ExtensionCommands.OPEN_HOME_PAGE);
            globalStateUpdateStub.should.not.have.been.called;
            const showOnNext: boolean = await vscode.workspace.getConfiguration().get(SettingConfigurations.HOME_SHOW_ON_NEXT_ACTIVATION);
            showOnNext.should.be.false;
        });

        it(`should update generator version to latest when the ${FabricRuntimeUtil.LOCAL_FABRIC} has not been generated`, async () => {
            await vscode.workspace.getConfiguration().update(SettingConfigurations.HOME_SHOW_ON_STARTUP, true, vscode.ConfigurationTarget.Global);

            dependencies['generator-fabric'] = '0.0.2';

            globalStateGetStub.returns({
                generatorVersion: '0.0.1'
            });

            executeCommandStub.resolves();
            mockRuntime.isCreated.resolves(false);
            showConfirmationWarningMessageStub.resolves(true);

            await ExtensionUtil.completeActivation(false);

            logSpy.should.have.been.calledWith(LogType.INFO, null, 'IBM Blockchain Platform Extension activated');
            executeCommandStub.should.not.have.been.calledWith(ExtensionCommands.OPEN_HOME_PAGE);
            mockRuntime.isCreated.should.have.been.calledOnce;
            showConfirmationWarningMessageStub.should.have.been.calledOnceWithExactly(`The local runtime configurations are out of date and must be torn down before updating. Do you want to teardown your local runtimes now?`);
            globalStateUpdateStub.should.have.been.calledWith({
                generatorVersion: dependencies['generator-fabric']
            });
        });

        it(`should set generated to 'false' if there are no local runtimes`, async () => {
            await FabricEnvironmentRegistry.instance().clear();

            await vscode.workspace.getConfiguration().update(SettingConfigurations.HOME_SHOW_ON_STARTUP, true, vscode.ConfigurationTarget.Global);

            dependencies['generator-fabric'] = '0.0.2';
            globalStateGetStub.returns({
                generatorVersion: '0.0.1'
            });

            executeCommandStub.resolves();
            mockRuntime.isCreated.resolves(false);

            showConfirmationWarningMessageStub.resolves(true);

            await ExtensionUtil.completeActivation(false);

            logSpy.should.have.been.calledWith(LogType.INFO, null, 'IBM Blockchain Platform Extension activated');
            executeCommandStub.should.not.have.been.calledWith(ExtensionCommands.OPEN_HOME_PAGE);
            mockRuntime.isCreated.should.not.have.been.calledOnce;
            showConfirmationWarningMessageStub.should.not.have.been.calledWith(`The local runtime configurations are out of date and must be torn down before updating. Do you want to teardown your local runtimes now?`);
            globalStateUpdateStub.should.have.been.calledWith({
                generatorVersion: dependencies['generator-fabric']
            });
        });

        // This test updates the generator to the lastest when the user is prompted by the showConfirmationWarningMessage.
        // It also doesn't start the newly generated Fabric, as it was stopped when the user selected 'Yes' at the prompt
        it(`should update generator version to latest when the user selects 'Yes' (and stopped)`, async () => {
            await vscode.workspace.getConfiguration().update(SettingConfigurations.HOME_SHOW_ON_STARTUP, true, vscode.ConfigurationTarget.Global);

            dependencies['generator-fabric'] = '0.0.2';
            globalStateGetStub.returns({
                generatorVersion: '0.0.1'
            });

            executeCommandStub.resolves();
            mockRuntime.isCreated.resolves(true);
            mockRuntime.getName.returns(FabricRuntimeUtil.LOCAL_FABRIC);
            showConfirmationWarningMessageStub.resolves(true);
            mockRuntime.isRunning.resolves(false);

            await ExtensionUtil.completeActivation(false);

            logSpy.should.have.been.calledWith(LogType.INFO, null, 'IBM Blockchain Platform Extension activated');
            executeCommandStub.should.not.have.been.calledWith(ExtensionCommands.OPEN_HOME_PAGE);
            mockRuntime.isCreated.should.have.been.calledOnce;
            showConfirmationWarningMessageStub.should.have.been.calledOnceWithExactly(`The local runtime configurations are out of date and must be torn down before updating. Do you want to teardown your local runtimes now?`);
            mockRuntime.isRunning.should.have.been.calledOnce;
            executeCommandStub.should.have.been.calledWith(ExtensionCommands.TEARDOWN_FABRIC, undefined, true, FabricRuntimeUtil.LOCAL_FABRIC);
            executeCommandStub.should.not.have.been.calledWith(ExtensionCommands.START_FABRIC);
            globalStateUpdateStub.should.have.been.calledWith({
                generatorVersion: dependencies['generator-fabric']
            });
        });

        // This test updates the generator to the lastest when the user is prompted by the showConfirmationWarningMessage.
        // It should also start the newly generated Fabric, as it was stopped when the user selected 'Yes' at the prompt
        it(`should update generator version to latest when the user selects 'Yes' (and started)`, async () => {
            await vscode.workspace.getConfiguration().update(SettingConfigurations.HOME_SHOW_ON_STARTUP, true, vscode.ConfigurationTarget.Global);

            dependencies['generator-fabric'] = '0.0.2';
            globalStateGetStub.returns({
                generatorVersion: '0.0.1'
            });

            executeCommandStub.resolves();
            mockRuntime.isCreated.resolves(true);
            showConfirmationWarningMessageStub.resolves(true);
            mockRuntime.isRunning.resolves(true);
            mockRuntime.getName.returns(FabricRuntimeUtil.LOCAL_FABRIC);

            await ExtensionUtil.completeActivation(false);

            logSpy.should.have.been.calledWith(LogType.INFO, null, 'IBM Blockchain Platform Extension activated');
            executeCommandStub.should.not.have.been.calledWith(ExtensionCommands.OPEN_HOME_PAGE);

            mockRuntime.isCreated.should.have.been.calledOnce;
            showConfirmationWarningMessageStub.should.have.been.calledOnceWithExactly(`The local runtime configurations are out of date and must be torn down before updating. Do you want to teardown your local runtimes now?`);
            mockRuntime.isRunning.should.have.been.calledOnce;
            executeCommandStub.should.have.been.calledWith(ExtensionCommands.TEARDOWN_FABRIC, undefined, true, FabricRuntimeUtil.LOCAL_FABRIC);
            executeCommandStub.should.have.been.calledWith(ExtensionCommands.START_FABRIC);
            globalStateUpdateStub.should.have.been.calledWith({
                generatorVersion: dependencies['generator-fabric']
            });
        });

        it(`should update generator version to latest when the user selects 'Yes' (and started) for multiple local fabrics`, async () => {
            mockRuntime.isCreated.resolves(true);
            mockRuntime.isRunning.resolves(true);

            const generatedLocalEnvironment: LocalMicroEnvironment = new LocalMicroEnvironment('generatedLocal', undefined, 1, UserInputUtil.V2_0);
            const nonGeneratedLocalEnvironment: LocalMicroEnvironment = new LocalMicroEnvironment('nonGeneratedLocal', undefined, 1, UserInputUtil.V2_0);

            const isGeneratedStub: sinon.SinonStub = mySandBox.stub(LocalMicroEnvironment.prototype, 'isCreated');
            isGeneratedStub.onCall(0).resolves(true); // generatedLocal
            isGeneratedStub.onCall(1).resolves(false); // nonGeneratedLocal

            const isRunningStub: sinon.SinonStub = mySandBox.stub(LocalMicroEnvironment.prototype, 'isRunning').resolves(true);
            isRunningStub.onCall(0).resolves(true); // generatedLocal
            isRunningStub.onCall(1).resolves(false); // nonGeneratedLocal

            ensureRuntimeStub.withArgs('generatedLocal', undefined, 1).resolves(generatedLocalEnvironment);
            ensureRuntimeStub.withArgs('nonGeneratedLocal', undefined, 1).resolves(nonGeneratedLocalEnvironment);

            await vscode.workspace.getConfiguration().update(SettingConfigurations.HOME_SHOW_ON_STARTUP, true, vscode.ConfigurationTarget.Global);

            dependencies['generator-fabric'] = '0.0.2';
            globalStateGetStub.returns({
                generatorVersion: '0.0.1'
            });

            executeCommandStub.resolves();

            showConfirmationWarningMessageStub.resolves(true);

            // We'll just use the local fabrics env directory
            const localEnv: FabricEnvironmentRegistryEntry = await FabricEnvironmentRegistry.instance().get(FabricRuntimeUtil.LOCAL_FABRIC);

            const generatedLocal: FabricEnvironmentRegistryEntry = {
                name: 'generatedLocal',
                environmentDirectory: localEnv.environmentDirectory,
                environmentType: EnvironmentType.LOCAL_MICROFAB_ENVIRONMENT,
                managedRuntime: true,
                numberOfOrgs: 1
            };
            const nonGeneratedLocal: FabricEnvironmentRegistryEntry = {
                name: 'nonGeneratedLocal',
                environmentDirectory: '',
                environmentType: EnvironmentType.LOCAL_MICROFAB_ENVIRONMENT,
                managedRuntime: true,
                numberOfOrgs: 1
            };
            const opsTool: FabricEnvironmentRegistryEntry = {
                url: 'some_website',
                environmentType: EnvironmentType.OPS_TOOLS_ENVIRONMENT,
                name: 'consoleEnv'
            };
            await FabricEnvironmentRegistry.instance().add(generatedLocal);
            await FabricEnvironmentRegistry.instance().add(nonGeneratedLocal);
            await FabricEnvironmentRegistry.instance().add(opsTool);

            await ExtensionUtil.completeActivation(false);

            ensureRuntimeStub.should.have.been.calledThrice;
            ensureRuntimeStub.should.have.been.calledWithExactly(generatedLocal.name, undefined, 1);
            ensureRuntimeStub.should.have.been.calledWithExactly(FabricRuntimeUtil.LOCAL_FABRIC, undefined, 1);
            ensureRuntimeStub.should.have.been.calledWith(nonGeneratedLocal.name, undefined, 1);
            ensureRuntimeStub.should.not.have.been.calledWith(opsTool.name);

            logSpy.should.have.been.calledWith(LogType.INFO, null, 'IBM Blockchain Platform Extension activated');
            executeCommandStub.should.not.have.been.calledWith(ExtensionCommands.OPEN_HOME_PAGE);

            isGeneratedStub.should.have.been.calledTwice;
            showConfirmationWarningMessageStub.should.have.been.calledOnceWithExactly(`The local runtime configurations are out of date and must be torn down before updating. Do you want to teardown your local runtimes now?`);

            mockRuntime.isRunning.should.have.been.calledOnce;
            isRunningStub.should.have.been.calledOnce; // generatedLocal

            executeCommandStub.should.have.been.calledWithExactly(ExtensionCommands.TEARDOWN_FABRIC, undefined, true, generatedLocal.name);
            executeCommandStub.should.have.been.calledWithExactly(ExtensionCommands.TEARDOWN_FABRIC, undefined, true, FabricRuntimeUtil.LOCAL_FABRIC);
            executeCommandStub.should.not.have.been.calledWith(ExtensionCommands.TEARDOWN_FABRIC, undefined, true, nonGeneratedLocal.name);

            executeCommandStub.should.have.been.calledWithExactly(ExtensionCommands.START_FABRIC, generatedLocal);
            executeCommandStub.should.have.been.calledWithExactly(ExtensionCommands.START_FABRIC, localEnv);
            executeCommandStub.should.not.have.been.calledWith(ExtensionCommands.START_FABRIC, nonGeneratedLocal);
            globalStateUpdateStub.should.have.been.calledWith({
                generatorVersion: dependencies['generator-fabric']
            });
        });

        it(`should force teardown and update generator version to latest when new major version is available`, async () => {
            mockRuntime.isCreated.resolves(true);
            mockRuntime.isRunning.resolves(true);

            const generatedLocalEnvironment: LocalMicroEnvironment = new LocalMicroEnvironment('generatedLocal', undefined, 1, UserInputUtil.V2_0);
            const nonGeneratedLocalEnvironment: LocalMicroEnvironment = new LocalMicroEnvironment('nonGeneratedLocal', undefined, 1, UserInputUtil.V2_0);

            const isGeneratedStub: sinon.SinonStub = mySandBox.stub(LocalMicroEnvironment.prototype, 'isCreated');
            isGeneratedStub.onCall(0).resolves(true); // generatedLocal
            isGeneratedStub.onCall(1).resolves(false); // nonGeneratedLocal

            const isRunningStub: sinon.SinonStub = mySandBox.stub(LocalMicroEnvironment.prototype, 'isRunning').resolves(true);
            isRunningStub.onCall(0).resolves(true); // generatedLocal
            isRunningStub.onCall(1).resolves(false); // nonGeneratedLocal

            ensureRuntimeStub.withArgs('generatedLocal', undefined, 1).resolves(generatedLocalEnvironment);
            ensureRuntimeStub.withArgs('nonGeneratedLocal', undefined, 1).resolves(nonGeneratedLocalEnvironment);

            await vscode.workspace.getConfiguration().update(SettingConfigurations.HOME_SHOW_ON_STARTUP, true, vscode.ConfigurationTarget.Global);

            dependencies['generator-fabric'] = '1.0.0';
            globalStateGetStub.returns({
                generatorVersion: '0.0.1'
            });

            executeCommandStub.resolves();

            // We'll just use the local fabrics env directory
            const localEnv: FabricEnvironmentRegistryEntry = await FabricEnvironmentRegistry.instance().get(FabricRuntimeUtil.LOCAL_FABRIC);

            const generatedLocal: FabricEnvironmentRegistryEntry = {
                name: 'generatedLocal',
                environmentDirectory: localEnv.environmentDirectory,
                environmentType: EnvironmentType.LOCAL_MICROFAB_ENVIRONMENT,
                managedRuntime: true,
                numberOfOrgs: 1
            };
            const nonGeneratedLocal: FabricEnvironmentRegistryEntry = {
                name: 'nonGeneratedLocal',
                environmentDirectory: '',
                environmentType: EnvironmentType.LOCAL_MICROFAB_ENVIRONMENT,
                managedRuntime: true,
                numberOfOrgs: 1
            };
            const opsTool: FabricEnvironmentRegistryEntry = {
                url: 'some_website',
                environmentType: EnvironmentType.OPS_TOOLS_ENVIRONMENT,
                name: 'consoleEnv'
            };
            await FabricEnvironmentRegistry.instance().add(generatedLocal);
            await FabricEnvironmentRegistry.instance().add(nonGeneratedLocal);
            await FabricEnvironmentRegistry.instance().add(opsTool);

            await ExtensionUtil.completeActivation(false);

            ensureRuntimeStub.should.have.been.calledThrice;
            ensureRuntimeStub.should.have.been.calledWithExactly(generatedLocal.name, undefined, 1);
            ensureRuntimeStub.should.have.been.calledWithExactly(FabricRuntimeUtil.LOCAL_FABRIC, undefined, 1);
            ensureRuntimeStub.should.have.been.calledWith(nonGeneratedLocal.name, undefined, 1);
            ensureRuntimeStub.should.not.have.been.calledWith(opsTool.name);

            logSpy.should.have.been.calledWith(LogType.INFO, null, 'IBM Blockchain Platform Extension activated');
            logSpy.should.have.been.calledWith(LogType.IMPORTANT, `A major version of the generator has been released. All local runtimes will be torn down.`);
            executeCommandStub.should.not.have.been.calledWith(ExtensionCommands.OPEN_HOME_PAGE);

            isGeneratedStub.should.have.been.calledTwice;
            showConfirmationWarningMessageStub.should.not.have.been.called;

            mockRuntime.isRunning.should.have.been.calledOnce;
            isRunningStub.should.have.been.calledOnce; // generatedLocal

            executeCommandStub.should.have.been.calledWithExactly(ExtensionCommands.TEARDOWN_FABRIC, undefined, true, generatedLocal.name);
            executeCommandStub.should.have.been.calledWithExactly(ExtensionCommands.TEARDOWN_FABRIC, undefined, true, FabricRuntimeUtil.LOCAL_FABRIC);
            executeCommandStub.should.not.have.been.calledWith(ExtensionCommands.TEARDOWN_FABRIC, undefined, true, nonGeneratedLocal.name);

            executeCommandStub.should.have.been.calledWithExactly(ExtensionCommands.START_FABRIC, generatedLocal);
            executeCommandStub.should.have.been.calledWithExactly(ExtensionCommands.START_FABRIC, localEnv);
            executeCommandStub.should.not.have.been.calledWith(ExtensionCommands.START_FABRIC, nonGeneratedLocal);
            globalStateUpdateStub.should.have.been.calledWith({
                generatorVersion: dependencies['generator-fabric']
            });
        });

        it(`shouldn't update the generator version to latest when the user selects 'No'`, async () => {
            await vscode.workspace.getConfiguration().update(SettingConfigurations.HOME_SHOW_ON_STARTUP, true, vscode.ConfigurationTarget.Global);
            dependencies['generator-fabric'] = '0.0.2';
            globalStateGetStub.returns({
                generatorVersion: '0.0.1'
            });

            executeCommandStub.resolves();
            mockRuntime.isCreated.resolves(true);
            showConfirmationWarningMessageStub.resolves(false);

            await ExtensionUtil.completeActivation(false);

            logSpy.should.have.been.calledWith(LogType.INFO, null, 'IBM Blockchain Platform Extension activated');
            executeCommandStub.should.not.have.been.calledWith(ExtensionCommands.OPEN_HOME_PAGE);
            mockRuntime.isCreated.should.not.have.been.called;
            showConfirmationWarningMessageStub.should.have.been.calledOnceWithExactly(`The local runtime configurations are out of date and must be torn down before updating. Do you want to teardown your local runtimes now?`);
            mockRuntime.isRunning.should.not.have.been.called;
            executeCommandStub.should.not.have.been.calledWith(ExtensionCommands.TEARDOWN_FABRIC, undefined, true, FabricRuntimeUtil.LOCAL_FABRIC);
            executeCommandStub.should.not.have.been.calledWith(ExtensionCommands.START_FABRIC);
            globalStateUpdateStub.should.not.have.been.calledWith({
                generatorVersion: dependencies['generator-fabric']
            });
        });

        it(`shouldn't update the generator version to latest when null`, async () => {
            await vscode.workspace.getConfiguration().update(SettingConfigurations.HOME_SHOW_ON_STARTUP, true, vscode.ConfigurationTarget.Global);

            globalStateGetStub.returns({
                generatorVersion: null
            });

            executeCommandStub.resolves();

            await ExtensionUtil.completeActivation(false);

            logSpy.should.have.been.calledWith(LogType.INFO, null, 'IBM Blockchain Platform Extension activated');
            executeCommandStub.should.not.have.been.calledWith(ExtensionCommands.OPEN_HOME_PAGE);
            mockRuntime.isCreated.should.not.have.been.called;
            showConfirmationWarningMessageStub.should.not.have.been.called;
            mockRuntime.isRunning.should.not.have.been.called;
            executeCommandStub.should.not.have.been.calledWith(ExtensionCommands.TEARDOWN_FABRIC, undefined, true, FabricRuntimeUtil.LOCAL_FABRIC);
            executeCommandStub.should.not.have.been.calledWith(ExtensionCommands.START_FABRIC);
            globalStateUpdateStub.should.have.been.calledWith({
                generatorVersion: dependencies['generator-fabric']
            });
        });

        it(`should set context of ${FabricRuntimeUtil.LOCAL_FABRIC} functionality to true`, async () => {

            mySandBox.stub(ExtensionUtil, 'getExtensionLocalFabricSetting').returns(true);
            await vscode.workspace.getConfiguration().update(SettingConfigurations.HOME_SHOW_ON_STARTUP, true, vscode.ConfigurationTarget.Global);
            dependencies['generator-fabric'] = '0.0.2';
            globalStateGetStub.returns({
                generatorVersion: '0.0.1'
            });

            executeCommandStub.resolves();
            mockRuntime.isCreated.resolves(true);
            showConfirmationWarningMessageStub.resolves(true);
            mockRuntime.isRunning.resolves(false);

            mockRuntime.getName.returns(FabricRuntimeUtil.LOCAL_FABRIC);

            await ExtensionUtil.completeActivation(false);

            logSpy.should.have.been.calledWith(LogType.INFO, null, 'IBM Blockchain Platform Extension activated');
            executeCommandStub.should.not.have.been.calledWith(ExtensionCommands.OPEN_HOME_PAGE);
            showConfirmationWarningMessageStub.should.have.been.calledOnceWithExactly(`The local runtime configurations are out of date and must be torn down before updating. Do you want to teardown your local runtimes now?`);
            executeCommandStub.should.have.been.calledWith(ExtensionCommands.TEARDOWN_FABRIC, undefined, true, FabricRuntimeUtil.LOCAL_FABRIC);
            executeCommandStub.should.not.have.been.calledWith(ExtensionCommands.START_FABRIC);
            globalStateUpdateStub.should.have.been.calledWith({
                generatorVersion: dependencies['generator-fabric']
            });

            executeCommandStub.should.have.been.calledWith('setContext', 'local-fabric-enabled', true);
        });

        it(`should set context of ${FabricRuntimeUtil.LOCAL_FABRIC} functionality to false`, async () => {
            mySandBox.stub(ExtensionUtil, 'getExtensionLocalFabricSetting').returns(false);

            await vscode.workspace.getConfiguration().update(SettingConfigurations.HOME_SHOW_ON_STARTUP, true, vscode.ConfigurationTarget.Global);
            dependencies['generator-fabric'] = '0.0.2';
            globalStateGetStub.returns({
                generatorVersion: '0.0.1'
            });

            executeCommandStub.resolves();
            mockRuntime.isCreated.resolves(true);
            showConfirmationWarningMessageStub.resolves(true);
            mockRuntime.isRunning.resolves(false);
            mockRuntime.getName.returns(FabricRuntimeUtil.LOCAL_FABRIC);

            await ExtensionUtil.completeActivation(false);

            logSpy.should.have.been.calledWith(LogType.INFO, null, 'IBM Blockchain Platform Extension activated');
            executeCommandStub.should.not.have.been.calledWith(ExtensionCommands.OPEN_HOME_PAGE);
            showConfirmationWarningMessageStub.should.have.been.calledOnceWithExactly(`The local runtime configurations are out of date and must be torn down before updating. Do you want to teardown your local runtimes now?`);
            executeCommandStub.should.have.been.calledWith(ExtensionCommands.TEARDOWN_FABRIC, undefined, true, FabricRuntimeUtil.LOCAL_FABRIC);
            executeCommandStub.should.not.have.been.calledWith(ExtensionCommands.START_FABRIC);
            globalStateUpdateStub.should.have.been.calledWith({
                generatorVersion: dependencies['generator-fabric']
            });

            executeCommandStub.should.have.been.calledWith('setContext', 'local-fabric-enabled', false);
        });

        it(`should set context of exportAppData feature to true if enabled by user`, async () => {
            await FeatureFlagManager.enable(FeatureFlagManager.EXPORTAPPDATA);
            mySandBox.stub(ExtensionUtil, 'getExtensionLocalFabricSetting').returns(true);
            await vscode.workspace.getConfiguration().update(SettingConfigurations.HOME_SHOW_ON_STARTUP, true, vscode.ConfigurationTarget.Global);
            dependencies['generator-fabric'] = '0.0.2';
            globalStateGetStub.returns({
                generatorVersion: '0.0.1'
            });

            executeCommandStub.resolves();
            mockRuntime.isCreated.resolves(true);
            showConfirmationWarningMessageStub.resolves(true);
            mockRuntime.isRunning.resolves(false);

            mockRuntime.getName.returns(FabricRuntimeUtil.LOCAL_FABRIC);

            await ExtensionUtil.completeActivation(false);

            logSpy.should.have.been.calledWith(LogType.INFO, null, 'IBM Blockchain Platform Extension activated');
            executeCommandStub.should.not.have.been.calledWith(ExtensionCommands.OPEN_HOME_PAGE);
            showConfirmationWarningMessageStub.should.have.been.calledOnceWithExactly(`The local runtime configurations are out of date and must be torn down before updating. Do you want to teardown your local runtimes now?`);
            executeCommandStub.should.have.been.calledWith(ExtensionCommands.TEARDOWN_FABRIC, undefined, true, FabricRuntimeUtil.LOCAL_FABRIC);
            executeCommandStub.should.not.have.been.calledWith(ExtensionCommands.START_FABRIC);
            globalStateUpdateStub.should.have.been.calledWith({
                generatorVersion: dependencies['generator-fabric']
            });

            executeCommandStub.should.have.been.calledWith('setContext', 'local-fabric-enabled', true);
            executeCommandStub.should.have.been.calledWith('setContext', 'exportAppData', true);
        });

        it(`should set context of exportAppData feature to false if not enabled by user`, async () => {
            await FeatureFlagManager.disable(FeatureFlagManager.EXPORTAPPDATA);
            mySandBox.stub(ExtensionUtil, 'getExtensionLocalFabricSetting').returns(true);
            await vscode.workspace.getConfiguration().update(SettingConfigurations.HOME_SHOW_ON_STARTUP, true, vscode.ConfigurationTarget.Global);
            dependencies['generator-fabric'] = '0.0.2';
            globalStateGetStub.returns({
                generatorVersion: '0.0.1'
            });

            executeCommandStub.resolves();
            mockRuntime.isCreated.resolves(true);
            showConfirmationWarningMessageStub.resolves(true);
            mockRuntime.isRunning.resolves(false);

            mockRuntime.getName.returns(FabricRuntimeUtil.LOCAL_FABRIC);

            await ExtensionUtil.completeActivation(false);

            logSpy.should.have.been.calledWith(LogType.INFO, null, 'IBM Blockchain Platform Extension activated');
            executeCommandStub.should.not.have.been.calledWith(ExtensionCommands.OPEN_HOME_PAGE);
            showConfirmationWarningMessageStub.should.have.been.calledOnceWithExactly(`The local runtime configurations are out of date and must be torn down before updating. Do you want to teardown your local runtimes now?`);
            executeCommandStub.should.have.been.calledWith(ExtensionCommands.TEARDOWN_FABRIC, undefined, true, FabricRuntimeUtil.LOCAL_FABRIC);
            executeCommandStub.should.not.have.been.calledWith(ExtensionCommands.START_FABRIC);
            globalStateUpdateStub.should.have.been.calledWith({
                generatorVersion: dependencies['generator-fabric']
            });

            executeCommandStub.should.have.been.calledWith('setContext', 'local-fabric-enabled', true);
            executeCommandStub.should.have.been.calledWith('setContext', 'exportAppData', false);
        });

        it(`should not set context if flag doens't require it`, async () => {
            await FeatureFlagManager.enable(FeatureFlagManager.EXPORTAPPDATA);
            mySandBox.stub(ExtensionUtil, 'getExtensionLocalFabricSetting').returns(true);
            await vscode.workspace.getConfiguration().update(SettingConfigurations.HOME_SHOW_ON_STARTUP, true, vscode.ConfigurationTarget.Global);
            dependencies['generator-fabric'] = '0.0.2';
            globalStateGetStub.returns({
                generatorVersion: '0.0.1'
            });

            executeCommandStub.resolves();
            mockRuntime.isCreated.resolves(true);
            showConfirmationWarningMessageStub.resolves(true);
            mockRuntime.isRunning.resolves(false);

            mockRuntime.getName.returns(FabricRuntimeUtil.LOCAL_FABRIC);

            const noContextFlag: IFeatureFlag = new FeatureFlag('noContextFlag', 'Description for fake flag', false);
            mySandBox.stub(FeatureFlagManager, 'ALL').value([
                FeatureFlagManager.EXPORTAPPDATA,
                noContextFlag
            ]);

            await ExtensionUtil.completeActivation(false);

            logSpy.should.have.been.calledWith(LogType.INFO, null, 'IBM Blockchain Platform Extension activated');
            executeCommandStub.should.not.have.been.calledWith(ExtensionCommands.OPEN_HOME_PAGE);
            showConfirmationWarningMessageStub.should.have.been.calledOnceWithExactly(`The local runtime configurations are out of date and must be torn down before updating. Do you want to teardown your local runtimes now?`);
            executeCommandStub.should.have.been.calledWith(ExtensionCommands.TEARDOWN_FABRIC, undefined, true, FabricRuntimeUtil.LOCAL_FABRIC);
            executeCommandStub.should.not.have.been.calledWith(ExtensionCommands.START_FABRIC);
            globalStateUpdateStub.should.have.been.calledWith({
                generatorVersion: dependencies['generator-fabric']
            });

            executeCommandStub.should.have.been.calledWith('setContext', 'local-fabric-enabled', true);
            executeCommandStub.should.have.been.calledWith('setContext', 'exportAppData', true);
        });

        it('should discover environments', async () => {
            dependencies['generator-fabric'] = '0.0.2';
            globalStateGetStub.returns({
                generatorVersion: '0.0.1'
            });
            const spy: sinon.SinonSpy = mySandBox.spy(ExtensionUtil, 'discoverEnvironments');
            await ExtensionUtil.completeActivation(false);
            spy.should.have.been.calledOnce;
        });
    });

    describe('setupLocalRuntime', () => {
        it(`should initialize the runtime manager`, async () => {
            const logSpy: sinon.SinonSpy = mySandBox.spy(VSCodeBlockchainOutputAdapter.instance(), 'log');

            const initializeStub: sinon.SinonStub = mySandBox.stub(LocalMicroEnvironmentManager.instance(), 'initialize').resolves();

            await ExtensionUtil.setupLocalRuntime();

            logSpy.should.have.been.calledOnce;
            logSpy.should.have.been.calledWith(LogType.INFO, undefined, 'Initializing local runtime manager');
            initializeStub.should.have.been.calledOnce;
        });
    });

    describe('onDidChangeConfiguration', () => {
        let mockRuntime: sinon.SinonStubbedInstance<LocalMicroEnvironment>;
        let affectsConfigurationStub: sinon.SinonStub;
        let executeCommandStub: sinon.SinonStub;
        let onDidChangeConfiguration: sinon.SinonStub;
        let logSpy: sinon.SinonSpy;
        let promises: any[] = [];
        let showConfirmationWarningMessageStub: sinon.SinonStub;
        let getSettingsStub: sinon.SinonStub;
        let updateSettingsStub: sinon.SinonStub;
        let getConfigurationStub: sinon.SinonStub;
        let hasPreReqsInstalledStub: sinon.SinonStub;
        let registerStub: sinon.SinonStub;
        let disposeExtensionStub: sinon.SinonStub;
        let initializeStub: sinon.SinonStub;
        const runtimeManager: LocalMicroEnvironmentManager = LocalMicroEnvironmentManager.instance();
        let ensureRuntimeStub: sinon.SinonStub;
        beforeEach(async () => {
            mySandBox.restore();
            await FabricEnvironmentRegistry.instance().clear();

            if (!ExtensionUtil.isActive()) {
                await ExtensionUtil.activateExtension();
            }

            await TestUtil.startLocalFabric();

            mockRuntime = mySandBox.createStubInstance(LocalMicroEnvironment);
            mockRuntime.isCreated.resolves(true);
            mockRuntime.isRunning.resolves(true);
            mockRuntime.getGateways.resolves([]);

            ensureRuntimeStub = mySandBox.stub(LocalMicroEnvironmentManager.instance(), 'ensureRuntime');
            ensureRuntimeStub.withArgs(FabricRuntimeUtil.LOCAL_FABRIC, undefined, 1).resolves(mockRuntime);

            runtimeManager['runtimes'] = new Map();
            runtimeManager['runtimes'].set(FabricRuntimeUtil.LOCAL_FABRIC, mockRuntime as unknown as LocalMicroEnvironment);

            initializeStub = mySandBox.stub(runtimeManager, 'initialize');
            initializeStub.resolves();

            affectsConfigurationStub = mySandBox.stub().resolves(true);

            onDidChangeConfiguration = mySandBox.stub(vscode.workspace, 'onDidChangeConfiguration');
            promises.push(new Promise((resolve: any): void => {
                onDidChangeConfiguration.callsFake((callback: any) => {
                    // Runs the code inside the handler
                    const promise: any = callback({
                        affectsConfiguration: affectsConfigurationStub
                    });
                    // Wait for the code to finish before resolving
                    promise.then(resolve);

                    // Return as a disposable
                    return {
                        dispose: (): void => {
                            return;
                        }
                    };
                });

            }));
            executeCommandStub = mySandBox.stub(vscode.commands, 'executeCommand');
            executeCommandStub.callThrough();
            executeCommandStub.withArgs('setContext', 'local-fabric-enabled').resolves();
            executeCommandStub.withArgs(ExtensionCommands.REFRESH_ENVIRONMENTS).resolves();
            executeCommandStub.withArgs(ExtensionCommands.REFRESH_GATEWAYS).resolves();
            executeCommandStub.withArgs(ExtensionCommands.REFRESH_WALLETS).resolves();
            executeCommandStub.withArgs(ExtensionCommands.OPEN_PRE_REQ_PAGE).resolves();

            logSpy = mySandBox.spy(VSCodeBlockchainOutputAdapter.instance(), 'log');
            showConfirmationWarningMessageStub = mySandBox.stub(UserInputUtil, 'showConfirmationWarningMessage');
            showConfirmationWarningMessageStub.resolves(true);
            getSettingsStub = mySandBox.stub();
            updateSettingsStub = mySandBox.stub();
            getConfigurationStub = mySandBox.stub(vscode.workspace, 'getConfiguration');
            getConfigurationStub.returns({
                get: getSettingsStub,
                update: updateSettingsStub
            });

            hasPreReqsInstalledStub = mySandBox.stub(DependencyManager.instance(), 'hasPreReqsInstalled');
            registerStub = mySandBox.stub(ExtensionUtil, 'registerPreActivationCommands');
            registerStub.callThrough();
            disposeExtensionStub = mySandBox.stub(ExtensionUtil, 'disposeExtension');
            disposeExtensionStub.callThrough();

            await FabricEnvironmentRegistry.instance().add({
                url: 'some_website',
                environmentType: EnvironmentType.OPS_TOOLS_ENVIRONMENT,
                name: 'consoleEnv'
            });
        });

        afterEach(() => {
            promises = [];
        });

        describe('local Fabric functionality is enabled on Eclipse Che', () => {

            beforeEach(async () => {
                mySandBox.stub(ExtensionUtil, 'isChe').returns(true);
                getSettingsStub.withArgs(SettingConfigurations.EXTENSION_LOCAL_FABRIC).returns(true);
                updateSettingsStub.withArgs(SettingConfigurations.EXTENSION_LOCAL_FABRIC, false, vscode.ConfigurationTarget.Global).resolves();
            });

            it('should report a warning and disable local Fabric functionality', async () => {
                const ctx: vscode.ExtensionContext = GlobalState.getExtensionContext();
                await ExtensionUtil.registerCommands(ctx);
                await Promise.all(promises);
                logSpy.should.have.been.calledOnceWithExactly(LogType.ERROR, sinon.match(/not supported/));
                updateSettingsStub.should.have.been.calledOnceWithExactly(SettingConfigurations.EXTENSION_LOCAL_FABRIC, false, vscode.ConfigurationTarget.Global);
            });

        });

        describe('local Fabric functionality is disabled on Eclipse Che', () => {

            beforeEach(async () => {
                mySandBox.stub(ExtensionUtil, 'isChe').returns(true);
                getSettingsStub.withArgs(SettingConfigurations.EXTENSION_LOCAL_FABRIC).returns(false);
                updateSettingsStub.withArgs(SettingConfigurations.EXTENSION_LOCAL_FABRIC, false, vscode.ConfigurationTarget.Global).resolves();
            });

            it('should do nothing', async () => {
                const ctx: vscode.ExtensionContext = GlobalState.getExtensionContext();
                await ExtensionUtil.registerCommands(ctx);
                await Promise.all(promises);
            });

        });

        describe(`local fabric functionality is enabled`, () => {
            beforeEach(async () => {
                getSettingsStub.withArgs(SettingConfigurations.EXTENSION_LOCAL_FABRIC).returns(true);
                getSettingsStub.withArgs(SettingConfigurations.FABRIC_RUNTIME).returns({
                    '1 Org Local Fabric': 8080
                });
                getSettingsStub.withArgs(SettingConfigurations.EXTENSION_DIRECTORY).returns(TestUtil.EXTENSION_TEST_DIR);
                updateSettingsStub.withArgs(SettingConfigurations.EXTENSION_LOCAL_FABRIC, false, vscode.ConfigurationTarget.Global).resolves();
            });

            it('should continue if bypass prereqs setting is true', async () => {
                getSettingsStub.withArgs(SettingConfigurations.EXTENSION_BYPASS_PREREQS).returns(true);

                const ctx: vscode.ExtensionContext = GlobalState.getExtensionContext();

                await ExtensionUtil.registerCommands(ctx);

                await Promise.all(promises);

                affectsConfigurationStub.should.have.been.calledWith(SettingConfigurations.EXTENSION_LOCAL_FABRIC);
                hasPreReqsInstalledStub.should.not.have.been.called;

                executeCommandStub.should.have.been.calledWith('setContext', 'local-fabric-enabled', true);
                executeCommandStub.should.have.been.calledWith(ExtensionCommands.REFRESH_ENVIRONMENTS);
                executeCommandStub.should.have.been.calledWith(ExtensionCommands.REFRESH_GATEWAYS);
                executeCommandStub.should.have.been.calledWith(ExtensionCommands.REFRESH_WALLETS);

                ensureRuntimeStub.should.have.been.calledOnce;

            });

            it('should initialize runtime if not generated', async () => {
                runtimeManager['runtimes'].clear();

                getSettingsStub.withArgs(SettingConfigurations.EXTENSION_BYPASS_PREREQS).returns(true);

                const ctx: vscode.ExtensionContext = GlobalState.getExtensionContext();

                const state: ExtensionData = GlobalState.get();
                state.createOneOrgLocalFabric = true;
                state.deletedOneOrgLocalFabric = false;
                await GlobalState.update(state);

                const globalStateUpdateSpy: sinon.SinonSpy = mySandBox.spy(GlobalState, 'update');
                await ExtensionUtil.registerCommands(ctx);

                await Promise.all(promises);

                globalStateUpdateSpy.should.have.been.calledOnce;
                const updateCall: any = globalStateUpdateSpy.getCall(0).args[0];
                updateCall.createOneOrgLocalFabric.should.equal(false);

                initializeStub.should.have.been.calledOnce;
                logSpy.should.have.been.calledWith(LogType.INFO, undefined, 'Initializing local runtime manager');
                affectsConfigurationStub.should.have.been.calledWith(SettingConfigurations.EXTENSION_LOCAL_FABRIC);
                hasPreReqsInstalledStub.should.not.have.been.called;

                executeCommandStub.should.have.been.calledWith('setContext', 'local-fabric-enabled', true);
                executeCommandStub.should.have.been.calledWith(ExtensionCommands.REFRESH_ENVIRONMENTS);
                executeCommandStub.should.have.been.calledWith(ExtensionCommands.REFRESH_GATEWAYS);
                executeCommandStub.should.have.been.calledWith(ExtensionCommands.REFRESH_WALLETS);

                ensureRuntimeStub.should.have.been.calledOnce;

            });

            it('should continue if all pre-reqs installed', async () => {
                getSettingsStub.withArgs(SettingConfigurations.EXTENSION_BYPASS_PREREQS).returns(false);
                hasPreReqsInstalledStub.resolves(true);
                disposeExtensionStub.resetHistory();
                const ctx: vscode.ExtensionContext = GlobalState.getExtensionContext();

                const state: ExtensionData = GlobalState.get();
                state.deletedOneOrgLocalFabric = true;
                await GlobalState.update(state);

                const globalStateUpdateSpy: sinon.SinonSpy = mySandBox.spy(GlobalState, 'update');
                await ExtensionUtil.registerCommands(ctx);

                await Promise.all(promises);

                globalStateUpdateSpy.should.not.have.been.called;

                initializeStub.should.not.have.been.called;

                affectsConfigurationStub.should.have.been.calledWith(SettingConfigurations.EXTENSION_LOCAL_FABRIC);
                hasPreReqsInstalledStub.should.have.been.calledOnce;

                disposeExtensionStub.should.have.been.calledOnce;
                disposeExtensionStub.should.not.have.been.calledTwice;
                executeCommandStub.should.have.been.calledWith('setContext', 'local-fabric-enabled', true);
                executeCommandStub.should.have.been.calledWith(ExtensionCommands.REFRESH_ENVIRONMENTS);
                executeCommandStub.should.have.been.calledWith(ExtensionCommands.REFRESH_GATEWAYS);
                executeCommandStub.should.have.been.calledWith(ExtensionCommands.REFRESH_WALLETS);

                ensureRuntimeStub.should.have.been.calledOnce;

            });

            it('should open pre-req page if not all pre-reqs are installed', async () => {
                executeCommandStub.resetHistory();
                getSettingsStub.withArgs(SettingConfigurations.EXTENSION_BYPASS_PREREQS).returns(false);
                hasPreReqsInstalledStub.resolves(false);
                disposeExtensionStub.returns(undefined);
                disposeExtensionStub.resetHistory();
                registerStub.resolves();
                const createTempCommands: sinon.SinonStub = mySandBox.stub(TemporaryCommandRegistry.instance(), 'createTempCommands').returns(undefined);
                const ctx: vscode.ExtensionContext = GlobalState.getExtensionContext();

                const state: ExtensionData = GlobalState.get();
                state.deletedOneOrgLocalFabric = true;
                await GlobalState.update(state);

                const globalStateUpdateSpy: sinon.SinonSpy = mySandBox.spy(GlobalState, 'update');
                await ExtensionUtil.registerCommands(ctx);

                await Promise.all(promises);

                globalStateUpdateSpy.should.not.have.been.called;
                initializeStub.should.not.have.been.called;

                affectsConfigurationStub.should.have.been.calledWith(SettingConfigurations.EXTENSION_LOCAL_FABRIC);
                hasPreReqsInstalledStub.should.have.been.calledOnce;

                disposeExtensionStub.should.have.been.calledTwice;
                registerStub.should.have.been.called;
                createTempCommands.should.have.been.calledWith(false, ExtensionCommands.OPEN_PRE_REQ_PAGE);
                executeCommandStub.should.have.been.calledWith(ExtensionCommands.OPEN_PRE_REQ_PAGE);
                executeCommandStub.should.not.have.been.calledWith('setContext', 'local-fabric-enabled', true);
                executeCommandStub.should.not.have.been.calledWith(ExtensionCommands.REFRESH_ENVIRONMENTS);
                executeCommandStub.should.not.have.been.calledWith(ExtensionCommands.REFRESH_GATEWAYS);
                executeCommandStub.should.not.have.been.calledWith(ExtensionCommands.REFRESH_WALLETS);

                ensureRuntimeStub.should.have.been.calledOnce;

            });

            it(`should initalize if runtimes cannot be retrieved and dependencies installed`, async () => {
                runtimeManager['runtimes'].clear();
                await FabricEnvironmentRegistry.instance().clear();
                getSettingsStub.withArgs(SettingConfigurations.EXTENSION_BYPASS_PREREQS).returns(false);
                disposeExtensionStub.resetHistory();
                hasPreReqsInstalledStub.resolves(true);
                const ctx: vscode.ExtensionContext = GlobalState.getExtensionContext();

                const state: ExtensionData = GlobalState.get();
                state.createOneOrgLocalFabric = true;
                state.deletedOneOrgLocalFabric = false;
                await GlobalState.update(state);

                const globalStateUpdateSpy: sinon.SinonSpy = mySandBox.spy(GlobalState, 'update');
                await ExtensionUtil.registerCommands(ctx);

                await Promise.all(promises);

                globalStateUpdateSpy.should.have.been.calledOnce;
                const updateCall: any = globalStateUpdateSpy.getCall(0).args[0];
                updateCall.createOneOrgLocalFabric.should.equal(false);
                affectsConfigurationStub.should.have.been.calledWith(SettingConfigurations.EXTENSION_LOCAL_FABRIC);
                hasPreReqsInstalledStub.should.have.been.calledOnce;

                logSpy.getCall(0).should.have.been.calledWith(LogType.INFO, undefined, 'Initializing local runtime manager');
                disposeExtensionStub.should.have.been.calledOnce;
                disposeExtensionStub.should.not.have.been.calledTwice;
                initializeStub.should.have.been.calledOnce;
                executeCommandStub.should.have.been.calledWith('setContext', 'local-fabric-enabled', true);
                executeCommandStub.should.have.been.calledWith(ExtensionCommands.REFRESH_ENVIRONMENTS);
                executeCommandStub.should.have.been.calledWith(ExtensionCommands.REFRESH_GATEWAYS);
                executeCommandStub.should.have.been.calledWith(ExtensionCommands.REFRESH_WALLETS);
                ensureRuntimeStub.should.not.have.been.called;

            });

            it('should should handle any errors when toggling functionality', async () => {
                getSettingsStub.withArgs(SettingConfigurations.EXTENSION_BYPASS_PREREQS).returns(false);

                const error: Error = new Error('Unable to get prereqs');
                hasPreReqsInstalledStub.throws(error);
                const ctx: vscode.ExtensionContext = GlobalState.getExtensionContext();

                const state: ExtensionData = GlobalState.get();
                state.deletedOneOrgLocalFabric = true;
                await GlobalState.update(state);

                const globalStateUpdateSpy: sinon.SinonSpy = mySandBox.spy(GlobalState, 'update');
                await ExtensionUtil.registerCommands(ctx);

                await Promise.all(promises);

                globalStateUpdateSpy.should.not.have.been.called;
                initializeStub.should.not.have.been.called;

                logSpy.should.have.been.calledWith(LogType.ERROR, `Error whilst toggling local Fabric functionality to true: ${error.message}`, `Error whilst toggling local Fabric functionality to true: ${error.toString()}`);
                affectsConfigurationStub.should.have.been.calledWith(SettingConfigurations.EXTENSION_LOCAL_FABRIC);
                hasPreReqsInstalledStub.should.have.been.called;

                executeCommandStub.should.not.have.been.calledWith('setContext', 'local-fabric-enabled', true);
                executeCommandStub.should.have.been.calledWith(ExtensionCommands.REFRESH_ENVIRONMENTS);
                executeCommandStub.should.have.been.calledWith(ExtensionCommands.REFRESH_GATEWAYS);
                executeCommandStub.should.have.been.calledWith(ExtensionCommands.REFRESH_WALLETS);
                ensureRuntimeStub.should.have.been.calledOnce;

            });

            it('should handle any errors when initializing', async () => {
                runtimeManager['runtimes'].clear();
                getSettingsStub.withArgs(SettingConfigurations.EXTENSION_BYPASS_PREREQS).returns(false);
                const error: Error = new Error('Unable to initialize');
                initializeStub.throws(error);
                await FabricEnvironmentRegistry.instance().clear();
                hasPreReqsInstalledStub.resolves(true);
                const ctx: vscode.ExtensionContext = GlobalState.getExtensionContext();

                const state: ExtensionData = GlobalState.get();
                state.createOneOrgLocalFabric = true;
                state.deletedOneOrgLocalFabric = false;
                await GlobalState.update(state);

                const globalStateUpdateSpy: sinon.SinonSpy = mySandBox.spy(GlobalState, 'update');
                await ExtensionUtil.registerCommands(ctx);

                await Promise.all(promises);

                globalStateUpdateSpy.should.not.have.been.called;

                hasPreReqsInstalledStub.should.have.been.calledOnce;
                initializeStub.should.have.been.calledOnce;

                logSpy.should.have.been.calledWith(LogType.ERROR, `Error initializing ${FabricRuntimeUtil.LOCAL_FABRIC}: ${error.message}`, `Error initializing ${FabricRuntimeUtil.LOCAL_FABRIC}: ${error.toString()}`);
                affectsConfigurationStub.should.have.been.calledWith(SettingConfigurations.EXTENSION_LOCAL_FABRIC);

                executeCommandStub.should.have.been.calledWith(ExtensionCommands.REFRESH_ENVIRONMENTS);
                executeCommandStub.should.have.been.calledWith(ExtensionCommands.REFRESH_GATEWAYS);
                executeCommandStub.should.have.been.calledWith(ExtensionCommands.REFRESH_WALLETS);
                ensureRuntimeStub.should.not.have.been.called;

            });
        });

        describe(`local fabric functionality is disabled`, () => {
            let deleteEnvironmentSpy: sinon.SinonSpy;
            beforeEach(async () => {

                getSettingsStub.withArgs(SettingConfigurations.EXTENSION_LOCAL_FABRIC).returns(false);
                getSettingsStub.withArgs(SettingConfigurations.FABRIC_RUNTIME).returns({
                    '1 Org Local Fabric': 8080
                });
                getSettingsStub.withArgs(SettingConfigurations.EXTENSION_DIRECTORY).returns(TestUtil.EXTENSION_TEST_DIR);
                updateSettingsStub.withArgs(SettingConfigurations.EXTENSION_LOCAL_FABRIC, true, vscode.ConfigurationTarget.Global).resolves();

                mockRuntime.isCreated.resetHistory();
                mockRuntime.isRunning.resetHistory();
                mockRuntime.getName.returns(FabricRuntimeUtil.LOCAL_FABRIC);
                deleteEnvironmentSpy = mySandBox.spy(FabricEnvironmentRegistry.instance(), 'delete');
            });

            it(`should return if runtime is running and user doesn't teardown`, async () => {
                showConfirmationWarningMessageStub.resolves(false);

                const ctx: vscode.ExtensionContext = GlobalState.getExtensionContext();

                await ExtensionUtil.registerCommands(ctx);

                await Promise.all(promises);

                affectsConfigurationStub.should.have.been.calledWith(SettingConfigurations.EXTENSION_LOCAL_FABRIC);
                showConfirmationWarningMessageStub.should.have.been.calledOnceWithExactly(`Toggling this feature will remove the world state and ledger data for all local runtimes. Do you want to continue?`);
                updateSettingsStub.should.have.been.calledWith(SettingConfigurations.EXTENSION_LOCAL_FABRIC, true, vscode.ConfigurationTarget.Global);
                ensureRuntimeStub.should.have.been.calledOnce;

            });

            it(`should set context if runtime is running and user does teardown`, async () => {
                await FabricGatewayRegistry.instance().add({
                    name: 'newGateway',
                    managedGateway: false,
                    associatedWallet: undefined,
                    connectionProfilePath: path.join('blockchain', 'extension', 'directory', 'gatewayOne', 'connection.json')
                });
                executeCommandStub.withArgs(ExtensionCommands.TEARDOWN_FABRIC, undefined, true, FabricRuntimeUtil.LOCAL_FABRIC).resolves();
                showConfirmationWarningMessageStub.resolves(true);

                const ctx: vscode.ExtensionContext = GlobalState.getExtensionContext();

                await ExtensionUtil.registerCommands(ctx);

                await Promise.all(promises);

                affectsConfigurationStub.should.have.been.calledWith(SettingConfigurations.EXTENSION_LOCAL_FABRIC);
                // mockRuntime.isCreated.should.have.been.calledOnce;
                showConfirmationWarningMessageStub.should.have.been.calledOnceWithExactly(`Toggling this feature will remove the world state and ledger data for all local runtimes. Do you want to continue?`);
                updateSettingsStub.should.not.have.been.calledWith(SettingConfigurations.EXTENSION_LOCAL_FABRIC, true, vscode.ConfigurationTarget.Global);

                deleteEnvironmentSpy.should.have.been.calledOnceWithExactly(FabricRuntimeUtil.LOCAL_FABRIC, true);
                executeCommandStub.should.have.been.calledWith('setContext', 'local-fabric-enabled', false);
                executeCommandStub.should.have.been.calledWith(ExtensionCommands.TEARDOWN_FABRIC, undefined, true, FabricRuntimeUtil.LOCAL_FABRIC);
                executeCommandStub.should.have.been.calledWith(ExtensionCommands.REFRESH_ENVIRONMENTS);
                executeCommandStub.should.have.been.calledWith(ExtensionCommands.REFRESH_GATEWAYS);
                executeCommandStub.should.have.been.calledWith(ExtensionCommands.REFRESH_WALLETS);
                ensureRuntimeStub.should.have.been.calledOnce;

            });

            it(`should set context if there are no runtimes`, async () => {

                // mockRuntime.isCreated.resolves(false);
                await FabricEnvironmentRegistry.instance().clear();
                const ctx: vscode.ExtensionContext = GlobalState.getExtensionContext();

                await ExtensionUtil.registerCommands(ctx);

                await Promise.all(promises);

                affectsConfigurationStub.should.have.been.calledWith(SettingConfigurations.EXTENSION_LOCAL_FABRIC);
                // mockRuntime.isCreated.should.have.been.calledOnce;
                showConfirmationWarningMessageStub.should.not.have.been.calledOnceWith(`Toggling this feature will remove the world state and ledger data for all local runtimes. Do you want to continue?`);
                updateSettingsStub.should.not.have.been.calledWith(SettingConfigurations.EXTENSION_LOCAL_FABRIC, true, vscode.ConfigurationTarget.Global);

                deleteEnvironmentSpy.should.not.have.been.calledOnceWithExactly(FabricRuntimeUtil.LOCAL_FABRIC, true);

                executeCommandStub.should.have.been.calledWith('setContext', 'local-fabric-enabled', false);
                executeCommandStub.should.not.have.been.calledWith(ExtensionCommands.TEARDOWN_FABRIC, undefined, true, FabricRuntimeUtil.LOCAL_FABRIC);
                executeCommandStub.should.have.been.calledWith(ExtensionCommands.REFRESH_ENVIRONMENTS);
                executeCommandStub.should.have.been.calledWith(ExtensionCommands.REFRESH_GATEWAYS);
                executeCommandStub.should.have.been.calledWith(ExtensionCommands.REFRESH_WALLETS);
                ensureRuntimeStub.should.not.have.been.called;

            });

            it(`should no nothing if there are no runtimes`, async () => {
                await FabricEnvironmentRegistry.instance().clear();
                const ctx: vscode.ExtensionContext = GlobalState.getExtensionContext();

                await ExtensionUtil.registerCommands(ctx);

                await Promise.all(promises);

                affectsConfigurationStub.should.have.been.calledWith(SettingConfigurations.EXTENSION_LOCAL_FABRIC);
                // mockRuntime.isCreated.should.not.have.been.calledOnce;
                mockRuntime.isRunning.should.not.have.been.called;
                showConfirmationWarningMessageStub.should.not.have.been.calledOnceWith(`Toggling this feature will remove the world state and ledger data for all local runtimes. Do you want to continue?`);
                updateSettingsStub.should.not.have.been.calledWith(SettingConfigurations.EXTENSION_LOCAL_FABRIC, true, vscode.ConfigurationTarget.Global);

                executeCommandStub.should.have.been.calledWith(ExtensionCommands.REFRESH_ENVIRONMENTS);
                executeCommandStub.should.have.been.calledWith(ExtensionCommands.REFRESH_GATEWAYS);
                executeCommandStub.should.have.been.calledWith(ExtensionCommands.REFRESH_WALLETS);
                ensureRuntimeStub.should.not.have.been.called;
            });

            it(`should handle any errors`, async () => {
                const error: Error = new Error('Unable to teardown');
                executeCommandStub.withArgs(ExtensionCommands.TEARDOWN_FABRIC, undefined, true, FabricRuntimeUtil.LOCAL_FABRIC).resolves();
                showConfirmationWarningMessageStub.resolves(true);

                const ctx: vscode.ExtensionContext = GlobalState.getExtensionContext();
                mySandBox.stub(LocalMicroEnvironmentManager.instance(), 'removeRuntime').throws(error);
                await ExtensionUtil.registerCommands(ctx);

                await Promise.all(promises);

                affectsConfigurationStub.should.have.been.calledWith(SettingConfigurations.EXTENSION_LOCAL_FABRIC);
                // mockRuntime.isCreated.should.have.been.calledOnce;
                showConfirmationWarningMessageStub.should.have.been.calledOnceWithExactly(`Toggling this feature will remove the world state and ledger data for all local runtimes. Do you want to continue?`);
                updateSettingsStub.should.not.have.been.calledWith(SettingConfigurations.EXTENSION_LOCAL_FABRIC, true, vscode.ConfigurationTarget.Global);

                deleteEnvironmentSpy.should.have.been.calledOnceWithExactly(FabricRuntimeUtil.LOCAL_FABRIC, true);

                executeCommandStub.should.not.have.been.calledWith('setContext', 'local-fabric-enabled', false);
                executeCommandStub.should.have.been.calledWith(ExtensionCommands.TEARDOWN_FABRIC, undefined, true, FabricRuntimeUtil.LOCAL_FABRIC);
                executeCommandStub.should.have.been.calledWith(ExtensionCommands.REFRESH_ENVIRONMENTS);
                executeCommandStub.should.have.been.calledWith(ExtensionCommands.REFRESH_GATEWAYS);
                executeCommandStub.should.have.been.calledWith(ExtensionCommands.REFRESH_WALLETS);
                ensureRuntimeStub.should.have.been.calledOnce;

            });
        });
    });

    describe('environment logs', () => {

        let getEnvironmentRegistryEntryStub: sinon.SinonStub;
        let originalRuntime: LocalMicroEnvironment;
        let mockConnection: sinon.SinonStubbedInstance<FabricEnvironmentConnection>;
        let startLogsStub: sinon.SinonStub;
        let stopLogsStub: sinon.SinonStub;

        before(async () => {
            if (!ExtensionUtil.isActive()) {
                await ExtensionUtil.activateExtension();
            }
        });
        beforeEach(async () => {
            await FabricEnvironmentRegistry.instance().clear();
            await TestUtil.startLocalFabric();

            const registryEntry: FabricEnvironmentRegistryEntry = await FabricEnvironmentRegistry.instance().get(FabricRuntimeUtil.LOCAL_FABRIC);
            getEnvironmentRegistryEntryStub = mySandBox.stub(FabricEnvironmentManager.instance(), 'getEnvironmentRegistryEntry').returns(registryEntry);
            mockConnection = mySandBox.createStubInstance(FabricEnvironmentConnection);
            startLogsStub = mySandBox.stub(LocalMicroEnvironment.prototype, 'startLogs').returns(undefined);
            stopLogsStub = mySandBox.stub(LocalMicroEnvironment.prototype, 'stopLogs').returns(undefined);
            originalRuntime = new LocalMicroEnvironment(FabricRuntimeUtil.LOCAL_FABRIC, 8080, 1, UserInputUtil.V2_0);
        });

        it(`should start logs if ${FabricRuntimeUtil.LOCAL_FABRIC} is connected`, async () => {
            const ctx: vscode.ExtensionContext = GlobalState.getExtensionContext();
            mySandBox.stub(LocalMicroEnvironmentManager.instance(), 'getRuntime').returns(originalRuntime);
            FabricEnvironmentManager.instance().removeAllListeners(); // For some reason, there seemed to be multiple listener - as startLogsStub was being called many times.

            await ExtensionUtil.registerCommands(ctx);

            const registryEntry: FabricEnvironmentRegistryEntry = await FabricEnvironmentRegistry.instance().get(FabricRuntimeUtil.LOCAL_FABRIC);

            FabricEnvironmentManager.instance().connect(mockConnection, registryEntry, ConnectedState.CONNECTED);

            startLogsStub.should.have.been.calledOnce;
        });

        it(`should not start the logs when other fabric connected is not a local environment`, async () => {
            const registryEntry: FabricEnvironmentRegistryEntry = new FabricEnvironmentRegistryEntry();
            registryEntry.name = 'myFabric';
            registryEntry.managedRuntime = false;
            getEnvironmentRegistryEntryStub.returns(registryEntry);

            const ctx: vscode.ExtensionContext = GlobalState.getExtensionContext();
            await ExtensionUtil.registerCommands(ctx);

            FabricEnvironmentManager.instance().connect(mockConnection, registryEntry, ConnectedState.CONNECTED);

            startLogsStub.should.not.have.been.called;
        });

        it('should stop the logs when disconnected', async () => {
            mySandBox.stub(LocalMicroEnvironmentManager.instance(), 'getRuntime').returns(originalRuntime);

            FabricEnvironmentManager.instance()['connection'] = undefined;

            FabricEnvironmentManager.instance().removeAllListeners(); // For some reason, there seemed to be multiple listener - as stopLogsStub was being called many times.

            const ctx: vscode.ExtensionContext = GlobalState.getExtensionContext();
            await ExtensionUtil.registerCommands(ctx);

            const registryEntry: FabricEnvironmentRegistryEntry = await FabricEnvironmentRegistry.instance().get(FabricRuntimeUtil.LOCAL_FABRIC);

            FabricEnvironmentManager.instance().connect(mockConnection, registryEntry, ConnectedState.CONNECTED);

            FabricEnvironmentManager.instance().disconnect();

            stopLogsStub.should.have.been.calledOnce;
        });

    });

    describe('getExtensionSaasConfigUpdatesSetting', () => {
        it('should get required cloud login setting', async () => {

            const result: any = ExtensionUtil.getExtensionSaasConfigUpdatesSetting();
            result.should.deep.equal(true);
        });
    });

    describe('discoverEnvironments', () => {

        let addStub: sinon.SinonStub;
        let updateStub: sinon.SinonStub;
        let existsStub: sinon.SinonStub;
        let mockAxios: MockAdapter;
        let expectedEnvironmentDirectory: string;

        beforeEach(() => {
            addStub = mySandBox.stub(FabricEnvironmentRegistry.instance(), 'add');
            updateStub = mySandBox.stub(FabricEnvironmentRegistry.instance(), 'update');
            existsStub = mySandBox.stub(FabricEnvironmentRegistry.instance(), 'exists');
            existsStub.resolves(false);
            mockAxios = new MockAdapter(Axios);
            mockAxios.onGet('http://console.microfab.example.org:9876/ak/api/v1/health').reply(200, {});
            const extensionDirectory: string = vscode.workspace.getConfiguration().get(SettingConfigurations.EXTENSION_DIRECTORY);
            const resolvedExtensionDirectory: string = FileSystemUtil.getDirPath(extensionDirectory);
            expectedEnvironmentDirectory = path.join(resolvedExtensionDirectory, FileConfigurations.FABRIC_ENVIRONMENTS, 'Microfab');
        });

        afterEach(() => {
            delete process.env.MICROFAB_SERVICE_HOST;
            delete process.env.MICROFAB_SERVICE_PORT;
            mockAxios.restore();
        });

        it('should not do anything if not running in Eclipse Che', async () => {
            await ExtensionUtil.discoverEnvironments();
            addStub.should.not.have.been.called;
            updateStub.should.not.have.been.called;
        });

        it('should not do anything if running in Eclipse Che, but MICROFAB_SERVICE_HOST is not set', async () => {
            mySandBox.stub(ExtensionUtil, 'isChe').returns(true);
            // process.env.MICROFAB_SERVICE_HOST = 'console.microfab.example.org';
            process.env.MICROFAB_SERVICE_PORT = '9876';
            await ExtensionUtil.discoverEnvironments();
            addStub.should.not.have.been.called;
            updateStub.should.not.have.been.called;
        });

        it('should not do anything if running in Eclipse Che, but MICROFAB_SERVICE_PORT is not set', async () => {
            mySandBox.stub(ExtensionUtil, 'isChe').returns(true);
            process.env.MICROFAB_SERVICE_HOST = 'console.microfab.example.org';
            // process.env.MICROFAB_SERVICE_PORT = '9876';
            await ExtensionUtil.discoverEnvironments();
            addStub.should.not.have.been.called;
            updateStub.should.not.have.been.called;
        });

        it('should not do anything if running in Eclipse Che, but the Microfab instance does not work', async () => {
            mySandBox.stub(ExtensionUtil, 'isChe').returns(true);
            process.env.MICROFAB_SERVICE_HOST = 'console.microfab.example.org';
            process.env.MICROFAB_SERVICE_PORT = '9876';
            mockAxios.onGet('http://console.microfab.example.org:9876/ak/api/v1/health').reply(404, {});
            await ExtensionUtil.discoverEnvironments();
            addStub.should.not.have.been.called;
            updateStub.should.not.have.been.called;
        });

        it('should discover and add a new environment for a remote Microfab instance running in Eclipse Che', async () => {
            mySandBox.stub(ExtensionUtil, 'isChe').returns(true);
            process.env.MICROFAB_SERVICE_HOST = 'console.microfab.example.org';
            process.env.MICROFAB_SERVICE_PORT = '9876';
            await ExtensionUtil.discoverEnvironments();
            addStub.should.have.been.calledOnceWithExactly({
                name: 'Microfab',
                managedRuntime: false,
                environmentType: EnvironmentType.MICROFAB_ENVIRONMENT,
                environmentDirectory: expectedEnvironmentDirectory,
                url: 'http://console.microfab.example.org:9876'
            });
        });

        it('should discover and update an existing environment for a remote Microfab instance running in Eclipse Che', async () => {
            mySandBox.stub(ExtensionUtil, 'isChe').returns(true);
            process.env.MICROFAB_SERVICE_HOST = 'console.microfab.example.org';
            process.env.MICROFAB_SERVICE_PORT = '9876';
            existsStub.resolves(true);
            await ExtensionUtil.discoverEnvironments();
            updateStub.should.have.been.calledOnceWithExactly({
                name: 'Microfab',
                managedRuntime: false,
                environmentType: EnvironmentType.MICROFAB_ENVIRONMENT,
                environmentDirectory: expectedEnvironmentDirectory,
                url: 'http://console.microfab.example.org:9876'
            });
        });

    });

    describe('isChe', () => {

        beforeEach(async () => {
            delete process.env.CHE_WORKSPACE_ID;
        });

        afterEach(async () => {
            delete process.env.CHE_WORKSPACE_ID;
        });

        it('should return true on Eclipse Che', () => {
            process.env.CHE_WORKSPACE_ID = 'workspacen5jfcuq4dy2cthww';
            ExtensionUtil.isChe().should.be.true;
        });

        it('should return false when not on Eclipse Che', () => {
            ExtensionUtil.isChe().should.be.false;
        });

    });

    describe('executeCommandInternal', () => {
        it('should return result', async () => {
            const executeCommandStub: sinon.SinonStub = mySandBox.stub(vscode.commands, 'executeCommand').resolves('something');
            const result: any = await ExtensionUtil.executeCommandInternal('mycommand', 'arg0', 'arg1', 'arg2');
            result.should.equal('something');
            executeCommandStub.should.have.been.calledOnceWithExactly('mycommand', 'arg0', 'arg1', 'arg2');
        });

        it('should handle errors', async () => {
            const error: Error = new Error('something has gone wrong');
            const executeCommandStub: sinon.SinonStub = mySandBox.stub(vscode.commands, 'executeCommand').resolves(error);
            await ExtensionUtil.executeCommandInternal('mycommand', 'arg0', 'arg1', 'arg2').should.be.rejectedWith(/something has gone wrong/);
            executeCommandStub.should.have.been.calledOnceWithExactly('mycommand', 'arg0', 'arg1', 'arg2');
        });

    });
});
