import React from 'react';
import BN from 'bn.js';
import { connect } from 'react-redux';
import { Form, Input, Button, Checkbox, Radio, Alert } from 'antd';
import { CheckboxChangeEvent } from 'antd/lib/checkbox';
import { RadioChangeEvent } from 'antd/lib/radio';
import { AppState } from 'store/reducers';
import AmountField from 'components/AmountField';
import Unit from 'components/Unit';
import SendState from './SendState';
import { blockchainDisplayName } from 'utils/constants';
import { getNodeChain } from 'modules/node/selectors';
import { getAdjustedFees } from 'modules/payment/selectors';
import { sendOnChain, resetSendPayment, getOnChainFeeEstimates } from 'modules/payment/actions';
import './ChainSend.less';

interface StateProps {
  account: AppState['account']['account'];
  chain: ReturnType<typeof getNodeChain>;
  sendOnChainReceipt: AppState['payment']['sendOnChainReceipt'];
  isSending: AppState['payment']['isSending'];
  sendError: AppState['payment']['sendError'];
  onChainFees: AppState['payment']['onChainFees'];
  feesError: AppState['payment']['feesError'];
  isFetchingFees: AppState['payment']['isFetchingFees'];
}

interface DispatchProps {
  sendOnChain: typeof sendOnChain;
  resetSendPayment: typeof resetSendPayment;
  getOnChainFeeEstimates: typeof getOnChainFeeEstimates;
}

interface OwnProps {
  close?(): void;
}

type Props = StateProps & DispatchProps & OwnProps;

interface State {
  amount: string;
  isSendAll: boolean;
  address: string;
  fee: number;
  showMoreInfo: boolean;
}

const INITIAL_STATE = {
  amount: '',
  isSendAll: false,
  address: '',
  fee: 0,
  showMoreInfo: false,
};

class ChainSend extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      ...INITIAL_STATE
    }
  }

  componentWillReceiveProps(nextProps: Props) {
    const { onChainFees } = this.props;
    if (nextProps.onChainFees !== onChainFees && nextProps.onChainFees !== null) {
      this.setState({ 
        fee: nextProps.onChainFees.fastestFee,
        showMoreInfo: true,
      });
    }
  }

  render() {
    // Early exit for send state
    const { sendOnChainReceipt, isSending, sendError, account, chain, onChainFees, isFetchingFees, feesError } = this.props;
    if (isSending || sendOnChainReceipt || sendError) {
      return (
        <SendState
          isLoading={isSending}
          error={sendError}
          result={sendOnChainReceipt && (
            <>
              <h3>Transaction ID</h3>
              <a
                href={`https://blockstream.info/tx/${sendOnChainReceipt.txid}`}
                target="_blank"
                rel="noopener nofollow"
              >
                {sendOnChainReceipt.txid}
              </a>
            </>
          )}
          back={this.props.resetSendPayment}
          reset={this.reset}
          close={this.props.close}
        />
      );
    }

    const { amount, isSendAll, address, fee, showMoreInfo } = this.state;
    const blockchainBalance = account ? account.blockchainBalance : '';
    const disabled = (!amount && !isSendAll) || !address ||
      (!!blockchainBalance && !!amount && (new BN(blockchainBalance).lt(new BN(amount))));

    return (
      <Form
        className="ChainSend"
        layout="vertical"
        onSubmit={this.handleSubmit}
      >
        <AmountField
          label="Amount"
          amount={amount}
          maximumSats={blockchainBalance}
          onChangeAmount={this.handleChangeAmount}
          required={!isSendAll}
          disabled={isSendAll}
          showFiat
        />
        <div className="ChainSend-sendAll">
          <Checkbox onChange={this.handleChangeSendAll} checked={isSendAll}>
            Send all
            {account && <strong> <Unit value={blockchainBalance} /> </strong>}
            in {blockchainDisplayName[chain]} wallet
          </Checkbox>
        </div>
        <Form.Item label="Recipient" required>
          <Input
            name="address"
            value={address}
            autoComplete="off"
            onChange={this.handleChangeAddress}
            placeholder="Enter Bitcoin wallet address"
          />
        </Form.Item>

        {showMoreInfo && (
          <>
            <Form.Item label="Fee" className="ChainSend-fees">
              {feesError && (
                <Alert type="warning" message={feesError.message} /> 
              )}
              {onChainFees && (
                <Radio.Group defaultValue={this.state.fee} onChange={this.handleChangeFee}>
                  <Radio.Button value={onChainFees.fastestFee}>Fast</Radio.Button>
                  <Radio.Button value={onChainFees.halfHourFee}>Normal</Radio.Button>
                  <Radio.Button value={onChainFees.hourFee}>Slow</Radio.Button>
                </Radio.Group>
              )}
            </Form.Item>

            <div className="ChainSend-details">
              <table><tbody>
                <tr>
                  <td>Amount</td>
                  <td>
                    <Unit value={isSendAll ? blockchainBalance : amount} />
                  </td>
                </tr>
                <tr>
                  <td>Fee</td>
                  <td>
                    {fee} <small>sats/b</small>
                  </td>
                </tr>
              </tbody></table>
            </div>          
          </>
        )}
        {!showMoreInfo &&
          <Button
            className="ChainSend-advanced"
            onClick={this.handleMoreInfo}
            type="primary"
            loading={isFetchingFees}
            ghost
          >
            Show advanced fields
          </Button>
        }
        <div className="ChainSend-buttons">
          <Button size="large" type="ghost" onClick={this.reset}>
            Reset
          </Button>
          <Button
            htmlType="submit"
            type="primary"
            size="large"
            disabled={disabled}
          >
            Send
          </Button>
        </div>
      </Form>
    );
  }

  private handleSubmit = (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const { amount, isSendAll, address, fee } = this.state;
    const args = isSendAll ? { send_all: true } : { amount };
    this.props.sendOnChain({
      ...args,
      addr: address,
      sat_per_byte: fee.toString(),
    });
  };  

  private handleChangeAmount = (amount: string) => {
    this.setState({ amount });
  };

  private handleChangeSendAll = (ev: CheckboxChangeEvent) => {
    this.setState({ isSendAll: ev.target.checked, amount: '' });
  };

  private handleChangeAddress = (ev: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({ address: ev.target.value });
  };

  private handleChangeFee = (ev: RadioChangeEvent) => {
    this.setState({ fee: parseInt(ev.target.value, 10) });
  };

  private handleMoreInfo = () => {
    this.props.getOnChainFeeEstimates();
  };

  private reset = () => {
    this.setState({ ...INITIAL_STATE });
    this.props.resetSendPayment();
  };
}

export default connect<StateProps, DispatchProps, OwnProps, AppState>(
  state => ({
    account: state.account.account,
    sendOnChainReceipt: state.payment.sendOnChainReceipt,
    isSending: state.payment.isSending,
    sendError: state.payment.sendError,
    onChainFees: getAdjustedFees(state),
    feesError: state.payment.feesError,
    isFetchingFees: state.payment.isFetchingFees,
    chain: getNodeChain(state),
  }),
  {
    sendOnChain,
    resetSendPayment,
    getOnChainFeeEstimates,
  },
)(ChainSend);