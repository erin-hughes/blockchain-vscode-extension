import React, { Component } from 'react';
import './TransactionDataInput.scss';
import { Button, Dropdown, FileUploaderItem, Form, FormGroup, Select, SelectItem } from 'carbon-components-react';
import ITransaction from '../../../interfaces/ITransaction';
import ISmartContract from '../../../interfaces/ISmartContract';
import { ExtensionCommands } from '../../../ExtensionCommands';
import Utils from '../../../Utils';
import IAssociatedTxdata from '../../../interfaces/IAssociatedTxdata';

interface IProps {
    smartContract: ISmartContract;
    associatedTxdata: IAssociatedTxdata | undefined;
    txdataTransactions: string[];
}

interface IState {
    smartContract: ISmartContract;
    associatedTxdata: IAssociatedTxdata | undefined;
    txdataTransactions: string[];
    selectedTransactionLabel: string;
}

class TransactionDataInput extends Component<IProps, IState> {
    constructor(props: Readonly<IProps>) {
        super(props);
        this.state = {
            smartContract: this.props.smartContract,
            associatedTxdata: this.props.associatedTxdata,
            txdataTransactions: [],
            selectedTransactionLabel: ''
        };

        this.submitTxn = this.submitTxn.bind(this);
        this.addTransactionDirectory = this.addTransactionDirectory.bind(this);
        this.removeTransactionDirectory = this.removeTransactionDirectory.bind(this);
        this.updateSelectedTransaction = this.updateSelectedTransaction.bind(this);
    }

    componentDidUpdate(prevProps: IProps): void {
        if (prevProps.associatedTxdata !== this.props.associatedTxdata) {
            this.setState({
                associatedTxdata: this.props.associatedTxdata,
                txdataTransactions: this.props.txdataTransactions,
            });
        }
    }

    parseArgs(activeTransaction: ITransaction, transactionArguments: string): string {
        let parsedArguments: string = transactionArguments.replace(/\n/g, '');
        for (const param of activeTransaction.parameters) {
            parsedArguments = parsedArguments.replace(`${param.name}: `, '');
        }
        return parsedArguments;
    }

    // TODO
    submitTxn(evaluate: boolean): void {
        // const activeTransaction: ITransaction = this.state.activeTransaction as ITransaction;

        // const command: string = evaluate ? ExtensionCommands.EVALUATE_TRANSACTION : ExtensionCommands.SUBMIT_TRANSACTION;
        // const args: string = this.parseArgs(activeTransaction, this.state.transactionArguments);

        // const data: any = {
        //     smartContract: this.state.smartContract.name,
        //     transactionName: activeTransaction.name,
        //     channelName: this.state.smartContract.channel,
        //     args,
        //     namespace: this.state.smartContract.namespace,
        //     transientData: this.state.transientData,
        //     evaluate,
        //     peerTargetNames: []
        // };
        // Utils.postToVSCode({command, data});
    }

    addTransactionDirectory(): void {
        Utils.postToVSCode({
            command: ExtensionCommands.ASSOCIATE_TRANSACTION_DATA_DIRECTORY,
            data: {
                label: this.state.smartContract.label,
                name: this.state.smartContract.name,
                channel: this.state.smartContract.channel
            }
        });
    }

    removeTransactionDirectory(): void {
        Utils.postToVSCode({
            command: ExtensionCommands.DISSOCIATE_TRANSACTION_DATA_DIRECTORY,
            data: {
                label: this.state.smartContract.label,
                name: this.state.smartContract.name,
                channel: this.state.smartContract.channel
            }
        });
        this.setState({
            selectedTransactionLabel: ''
        });
    }

    updateSelectedTransaction(data: any): void {
        this.setState({
            selectedTransactionLabel: data.selectedItem
        });
    }

    renderTransactionDirectorySection(): JSX.Element {
        if (this.state.associatedTxdata) {
            return (
                <>
                    <FormGroup legendText='Select transaction directory' id='select-txn-data-directory'>
                        <h6>Select transaction directory</h6>
                        <p>Not sure how to get started? Find out more information here</p>
                        <FileUploaderItem name={this.state.associatedTxdata.transactionDataPath} status='edit' onDelete={this.removeTransactionDirectory}></FileUploaderItem>
                        <Dropdown
                            ariaLabel='dropdown'
                            id='transaction-label-select'
                            invalidText='A valid value is required'
                            items={this.state.txdataTransactions}
                            label='Select the transaction name'
                            titleText='Transaction name*'
                            type='default'
                            selectedItem={this.state.selectedTransactionLabel ? this.state.selectedTransactionLabel : 'Choose an option'}
                            onChange={this.updateSelectedTransaction}
                        />
                    </FormGroup>
                </>
            );
        } else {
            return (
                <>
                    <FormGroup legendText='Select transaction directory' id='select-txn-data-directory'>
                        <h6>Select transaction directory</h6>
                        <p>Not sure how to get started? Find out more information here</p>
                        <Button size='field' onClick={this.addTransactionDirectory}>Add directory</Button>
                    </FormGroup>
                    <FormGroup legendText='Select transaction label' id='select-transaction-label'>
                        <Dropdown
                            ariaLabel='dropdown'
                            id='transaction-label-select'
                            invalidText='A valid value is required'
                            items={[]}
                            label='Select the transaction name'
                            titleText='Transaction name*'
                            type='default'
                            selectedItem={'Choose an option'}
                            disabled={true}
                        />
                    </FormGroup>
                </>
            );
        }
    }

    render(): JSX.Element {
        return (
            <Form id='create-txn-form'>
                <FormGroup legendText='Peer targeting' id='target-peer-input'>
                    <Select id='peers-select' labelText='Peers' className='select-width hide-label'>
                        <SelectItem disabled={false} hidden={false} text='Select a peer' value='select-a-peer'/>
                    </Select>
                </FormGroup>
                {this.renderTransactionDirectorySection()}
                <FormGroup legendText='Submit and Evaluate buttons' id='submit-and-evaluate-buttons'>
                    <div className='submit-txn-button-container'>
                        <Button size='field' className='submit-txn-button' id='evaluate-button' onClick={(): void => this.submitTxn(true)}>Evaluate</Button>
                        <div className='button-separator'/>
                        <Button size='field' className='submit-txn-button' id='submit-button' onClick={(): void => this.submitTxn(false)}>Submit</Button>
                    </div>
                </FormGroup>
            </Form>
        );
    }
}

export default TransactionDataInput;
