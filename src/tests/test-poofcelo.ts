import {PoofCeloKit} from "../kit"
import {newKit} from "@celo/contractkit"
import {MockWrappedCeloInstance, PoofCELOInstance} from "../../types/truffle-contracts";
import {toBN} from "web3-utils";
const PoofCELO = artifacts.require("PoofCELO");
const MockWrappedCelo = artifacts.require("MockWrappedCelo");

const kit = newKit("http://127.0.0.1:7545")
const govKit = newKit("http://127.0.0.1:7545")

const initialWrappedCelo = 1000000000;
const toDeposit = 100;
const toWithdraw = 100;

contract("PoofCELO", async (accounts) => {
  let poofCelo: PoofCELOInstance;
  let poofCeloKit: PoofCeloKit;
  let mockWrappedCelo1: MockWrappedCeloInstance;
  let mockWrappedCelo2: MockWrappedCeloInstance;

  const alice = accounts[0];
  const bob = accounts[1];
  const governance = accounts[2];
  govKit.defaultAccount = governance;
  const admin = accounts[3];
  const treasury = accounts[4];

  before(async () => {
    poofCelo = await PoofCELO.new(governance, admin);
    poofCeloKit = new PoofCeloKit(kit, poofCelo.address)

    mockWrappedCelo1 = await MockWrappedCelo.new();
    await mockWrappedCelo1.mint(initialWrappedCelo, {from: alice});
    await mockWrappedCelo1.approve(poofCelo.address, toBN(initialWrappedCelo), {from: alice});
    await mockWrappedCelo1.setExchangeRate(1);
    mockWrappedCelo2 = await MockWrappedCelo.new();
    await mockWrappedCelo2.mint(initialWrappedCelo, {from: bob});
    await mockWrappedCelo2.approve(poofCelo.address, toBN(initialWrappedCelo), {from: bob});
    await mockWrappedCelo2.setExchangeRate(4);
  })

  describe("#addWrappedCelo", () => {
    it("should work", async () => {
      assert.equal((await poofCeloKit.wrappedCelos()).length, 0)
      await poofCeloKit.addWrappedCelo(mockWrappedCelo1.address).send({from: governance});
      await poofCeloKit.addWrappedCelo(mockWrappedCelo2.address).send({from: governance});
      assert.equal((await poofCeloKit.wrappedCelos()).length, 2)
    })
  })

  describe("#totalSupplyCELO", () => {
    it('should initialize to 0', async () => {
      assert.equal(await poofCeloKit.totalSupplyCELO(), "0")
    })
  })

  describe("#deposit", () => {
    it('should disallow depositing 0', async () => {
      try {
        await poofCeloKit.deposit(0, 2).send({from: alice})
      } catch (e) {
        expect(e.message).to.contain("Can't deposit a zero amount")
      }
    })
    it('should disallow depositing with an unsupported wrappedCeloIdx', async () => {
      try {
        await poofCeloKit.deposit(1, 2).send({from: alice})
      } catch (e) {
        expect(e.message).to.contain("wrappedCeloIdx out of bounds")
      }
    })
    it('should work', async () => {
      // Deposit mockWrappedCelo1
      await poofCeloKit.deposit(toDeposit, 0).send({from: alice})
      assert.isTrue((await poofCelo.balanceOf(alice)).eq(toBN(toDeposit)))
      assert.isTrue((await mockWrappedCelo1.balanceOf(alice)).eq(toBN(initialWrappedCelo - toDeposit)))
      assert.equal((await poofCeloKit.totalSupplyCELO()), toDeposit.toString())

      // Deposit mockWrappedCelo2
      await poofCeloKit.deposit(toDeposit, 1).send({from: bob})
      assert.isTrue((await poofCelo.balanceOf(bob)).eq(toBN(toDeposit * 4)))
      assert.isTrue((await mockWrappedCelo2.balanceOf(bob)).eq(toBN(initialWrappedCelo - toDeposit)))
      assert.equal((await poofCeloKit.totalSupplyCELO()), (toDeposit + toDeposit * 4).toString())
    })
  })

  describe("fees", () => {
    it("should fail if the fee is too high", async () => {
      try {
        await poofCeloKit.setFeeDivisor(99).send({from: governance});
      } catch (e) {
        expect(e.message).to.contain("New fee rate is too high");
      }
    })
    it("should set properly", async () => {
      poofCeloKit.setFeeTo(treasury).send({from: governance});
      assert.equal(await poofCelo.feeTo(), treasury)
      poofCeloKit.setFeeDivisor(100).send({from: governance});
      assert.isTrue((await poofCelo.feeDivisor()).eq(toBN(100)))
      poofCeloKit.clearFeeDivisor().send({from: governance});
      assert.isTrue((await poofCelo.feeDivisor()).eq(toBN(0)))
      poofCeloKit.setFeeDivisor(100).send({from: governance});
      assert.isTrue((await poofCelo.feeDivisor()).eq(toBN(100)))
    })
  })

  describe("#withdraw", () => {
    it('should disallow withdrawing 0', async () => {
      try {
        await poofCeloKit.withdraw(0, 2).send({from: alice})
      } catch (e) {
        expect(e.message).to.contain("Can't withdraw a zero amount")
      }
    })
    it('should disallow withdrawing with an unsupported wrappedCeloIdx', async () => {
      try {
        await poofCeloKit.withdraw(1, 2).send({from: alice})
      } catch (e) {
        expect(e.message).to.contain("wrappedCeloIdx out of bounds")
      }
    })
    it('should work', async () => {
      // Withdraw mockWrappedCelo1
      await poofCeloKit.withdraw(toWithdraw, 0).send({from: alice})
      assert.isTrue((await poofCelo.balanceOf(alice)).eq(toBN(0)))
      const fee1 = toBN(toDeposit).div(toBN(100));
      assert.isTrue((await mockWrappedCelo1.balanceOf(alice)).eq(toBN(initialWrappedCelo).sub(fee1)))
      assert.equal((await poofCeloKit.totalSupplyCELO()), (toDeposit * 4).toString())

      // Deposit mockWrappedCelo2
      await poofCeloKit.withdraw(toWithdraw * 4, 1).send({from: bob})
      assert.isTrue((await poofCelo.balanceOf(bob)).eq(toBN(0)))
      const fee2 = toBN(toDeposit).div(toBN(100));
      assert.isTrue((await mockWrappedCelo2.balanceOf(bob)).eq(toBN(initialWrappedCelo).sub(fee2)))
      assert.equal(await poofCeloKit.totalSupplyCELO(), "0")
    })
  })

  describe("#addCeloSupply", () => {
    it("should work", async () => {
      assert.equal(await poofCeloKit.totalSupplyCELO(), "0")
      await poofCeloKit.addCeloSupply(10).send({from: admin});
      await poofCeloKit.addCeloSupply(5).send({from: admin});
      assert.equal(await poofCeloKit.totalSupplyCELO(), "15")
    })
  })
})
