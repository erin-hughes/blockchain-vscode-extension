import React, { Component } from 'react';
import './TransactionPage.scss';
import { ContentSwitcher, Switch } from 'carbon-components-react';
import TransactionManualInput from '../../elements/TransactionManualInput/TransactionManualInput';
import TransactionDataInput from '../../elements/TransactionDataInput/TransactionDataInput';
import TransactionOutput from '../../elements/TransactionOutput/TransactionOutput';
import ISmartContract from '../../../interfaces/ISmartContract';
import IAssociatedTxdata from '../../../interfaces/IAssociatedTxdata';

interface IProps {
    transactionViewData: {gatewayName: string, smartContract: ISmartContract, associatedTxdata: any, txdataTransactions: string[] };
    transactionOutput: string;
}

interface IState {
    gatewayName: string;
    smartContract: ISmartContract;
    associatedTxdata: IAssociatedTxdata | undefined;
    txdataTransactions: string[];
    transactionOutput: string;
    manualInput: boolean;
}

class TransactionPage extends Component<IProps, IState> {
    constructor(props: Readonly<IProps>) {
        super(props);
        this.state = {
            gatewayName: this.props.transactionViewData.gatewayName,
            smartContract: this.props.transactionViewData.smartContract,
            associatedTxdata: this.props.transactionViewData.associatedTxdata,
            txdataTransactions: this.props.transactionViewData.txdataTransactions,
            transactionOutput: this.props.transactionOutput,
            manualInput: false
        };
        this.toggleManualInput = this.toggleManualInput.bind(this);
    }

    componentDidUpdate(prevProps: IProps): void {
        if (prevProps.transactionViewData.associatedTxdata !== this.props.transactionViewData.associatedTxdata) {
            this.setState({
                associatedTxdata: this.props.transactionViewData.associatedTxdata,
                txdataTransactions: this.props.transactionViewData.txdataTransactions
            });
        }
    }

    toggleManualInput(): void {
        this.setState((prevState: IState) => ({
            ...prevState,
            manualInput: !prevState.manualInput
        }));
    }

    render(): JSX.Element {
        return (
            <div className='page-container bx--grid' data-test-id='txn-page'>
                <div className='inner-container bx--row'>
                    <div className='page-contents bx--col'>
                        <div className='titles-container'>
                            <span className='home-link'>Transacting with: {this.state.gatewayName} > {this.state.smartContract.channel} > {this.state.smartContract.label}</span>
                            <h2>Create a new transaction</h2>
                        </div>
                        <div className='contents-container bx--row'>
                            <div className='bx--col'>
                            <ContentSwitcher selectionMode='manual' onChange={this.toggleManualInput}>
                                {/* The typescript types need the onClick and onKeyDown functions which I don't need, so I've passed empty callbacks */}
                                <Switch name='one' text='First section' onClick={() => { /** */}} onKeyDown={() => {/** */}}/>
                                <Switch name='two' text='Second section' onClick={() => { /** */}} onKeyDown={() => {/** */}}/>
                            </ContentSwitcher>
                                {this.state.manualInput === true
                                    ? <TransactionManualInput smartContract={this.state.smartContract}/>
                                    : <TransactionDataInput smartContract={this.state.smartContract} associatedTxdata={this.state.associatedTxdata} txdataTransactions={this.state.txdataTransactions}/>
                                }
                            </div>
                        </div>
                    </div>
                    <div className='bx--col'>
                        <TransactionOutput output={this.state.transactionOutput}/>
                    </div>
                </div>
            </div>
        );
    }

}

export default TransactionPage;
