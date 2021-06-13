import {Address, ContractKit} from "@celo/contractkit"
import {RewardsCelo, ABI} from "../types/web3-v1-contracts/RewardsCELO";
import {toTransactionObject} from "@celo/connect"

export class RewardsCeloKit {
  public readonly contract: RewardsCelo

  constructor(private kit: ContractKit, address: Address) {
    this.contract = new kit.web3.eth.Contract(ABI, address) as RewardsCelo
  }

  public deposit = (toDeposit: number, wrappedCeloIdx: number) => {
    const txo = this.contract.methods.deposit(toDeposit, wrappedCeloIdx)
    return toTransactionObject(this.kit.connection, txo);
  }

  public withdraw = (toWithdraw: number) => {
    const txo = this.contract.methods.withdraw(toWithdraw)
    return toTransactionObject(this.kit.connection, txo);
  }

  public addWrappedCelo = (wrappedCelo: Address) => {
    const txo = this.contract.methods.addWrappedCelo(wrappedCelo)
    return toTransactionObject(this.kit.connection, txo);
  }

  public wrappedCelos = async (): Promise<Array<string>> => {
    return (await this.contract.getPastEvents("WrappedCeloAdded", {
      fromBlock: 0,
      toBlock: "latest",
    })).map((event) => (event.returnValues.wrappedCelo));
  }

  public getTotalSupplyCELO = (): Promise<string> => {
    return this.contract.methods.getTotalSupplyCELO().call();
  }

  public setFeeTo = (feeTo: Address) => {
    const txo = this.contract.methods.setFeeTo(feeTo);
    return toTransactionObject(this.kit.connection, txo);
  }

  public setFeeDivisor = (feeDivisor: number) => {
    const txo = this.contract.methods.setFeeDivisor(feeDivisor);
    return toTransactionObject(this.kit.connection, txo);
  }

  public clearFeeDivisor = () => {
    const txo = this.contract.methods.clearFeeDivisor();
    return toTransactionObject(this.kit.connection, txo);
  }

  public banWrappedCelo = (wrappedCeloIdx: number) => {
    const txo = this.contract.methods.banWrappedCelo(wrappedCeloIdx);
    return toTransactionObject(this.kit.connection, txo);
  }

  public unbanWrappedCelo = (wrappedCeloIdx: number) => {
    const txo = this.contract.methods.unbanWrappedCelo(wrappedCeloIdx);
    return toTransactionObject(this.kit.connection, txo);
  }
}
