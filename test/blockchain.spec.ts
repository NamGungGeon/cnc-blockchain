import Block from "../types/block";
import Blockchain from "../types/blockchain";
import Transaction from "../types/transaction";

import assert from "assert";
import { reversePromiseState } from "./util";

const { generateKey, keys } = require("../keygen");

const k1Key = generateKey("k1");
const k1Public = k1Key.getPublic("hex");
const k2Key = generateKey("k2");
const k2Public = k2Key.getPublic("hex");

describe("cnc-blockchain test: offline env", () => {
  const blockchain = new Blockchain();

  describe("블록체인 생성", () => {
    it("체인 생성 시 제네시스 블록이 올바른가?", (done) => {
      if (
        blockchain.getLatestBlock().calcHash() ===
        blockchain.createGenesisBlock().calcHash()
      )
        done();
    });
    it("제네시스 블록 변조를 감지할 수 있는가?", (done) => {
      const tmpBlockchain = new Blockchain();
      tmpBlockchain.chain[0].prevHash = "FAKE HASH";
      if (!tmpBlockchain.isValid()) {
        done();
      }
    });
  });
  describe("트랜잭션 테스트", () => {
    it("fromAddr이 아닌 사람이 트랜잭션에 서명하면 오류 발생", (done) => {
      try {
        const tx = new Transaction(k1Public, k2Public, 0);
        tx.signTransaction(k2Key);
      } catch (e) {
        // console.error(e);
        done();
      }
    });
    it("fromAddr이 서명하면 정상 처리", (done) => {
      try {
        const tx = new Transaction(k1Public, k2Public, 0);
        tx.signTransaction(k1Key);
        done();
      } catch (e) {
        // console.error(e);
      }
    });
    it("toAddr이 없는 트랜잭션 추가시 오류 발생", (done) => {
      blockchain.pendingTransactions = [];
      try {
        const tx = new Transaction(k1Public, "", 0);
        tx.signTransaction(k1Key);

        blockchain.addTransaction(tx);
      } catch (e) {
        done();
      }
    });
    it("정상 트랜잭션을 블록체인에 추가하기", (done) => {
      blockchain.pendingTransactions = [];
      try {
        const tx = new Transaction(k1Public, k2Public, 0);
        tx.signTransaction(k1Key);

        blockchain.addTransaction(tx);
        done();
      } catch (e) {
        // console.error(e);
      }
    });
    it("같은 사람(fromAddr)이 여러 개의 거래를 동시에 등록", (done) => {
      blockchain.pendingTransactions = [];
      try {
        const tx = new Transaction(k2Public, k1Public, 0);
        tx.signTransaction(k2Key);

        blockchain.addTransaction(tx);
        blockchain.addTransaction(tx);
      } catch (e) {
        // console.error(e);
        done();
      }
    });

    it("NFT를 생성할 때 지정된 지갑 주소를 대상으로 하지 않으면 오류 발생", (done) => {
      blockchain.pendingTransactions = [];
      const tx = new Transaction(k1Public, k2Public, 0, "nftnftnft");
      tx.signTransaction(k1Key);
      try {
        blockchain.addTransaction(tx);
      } catch (e) {
        done();
      }
    });

    it("음수 금액이 설정된 경우 오류 발생", (done) => {
      blockchain.pendingTransactions = [];
      try {
        const tx = new Transaction(k1Public, k2Public, -100);
        tx.isValid();
      } catch (e) {
        done();
      }
    });
    it("잔액보다 많은 금액을 보내려는 경우 오류 발생", (done) => {
      blockchain.pendingTransactions = [];
      const tx = new Transaction(k1Public, k2Public, 100);
      tx.signTransaction(k1Key);
      try {
        blockchain.addTransaction(tx);
      } catch (e) {
        done();
      }
    });
  });
  describe("블록 테스트", () => {
    it("잘못된 트랜잭션(서명 안됨)이 포함된 블록의 유효성 검사", () => {
      const tx = new Transaction(k1Public, k2Public, 0);
      const block = new Block(
        new Date().getTime(),
        [tx],
        blockchain.getLatestBlock().hash
      );
      return reversePromiseState(blockchain.attachNewBlock(block));
    });
    it("잘못된 트랜잭션(음수 금액)이 포함된 블록의 유효성 검사", () => {
      const tx = new Transaction(k1Public, k2Public, -100);
      tx.signTransaction(k1Key);
      const block = new Block(
        new Date().getTime(),
        [tx],
        blockchain.getLatestBlock().hash
      );

      return reversePromiseState(blockchain.attachNewBlock(block));
    });
    it("해시가 일치하지 않는 블록 attach시 오류 발생", () => {
      const tx = new Transaction(k1Public, k2Public, 0);
      tx.signTransaction(k1Key);
      const block = new Block(new Date().getTime(), [tx], "FAKE_HASH");
      return reversePromiseState(blockchain.attachNewBlock(block));
    });
    it("블록 채굴(POW)", (done) => {
      blockchain.pendingTransactions = [];
      const tx = new Transaction(k1Public, k2Public, 0);
      tx.signTransaction(k1Key);
      blockchain.addTransaction(tx);

      const block = blockchain.minePendingTransactions(k1Public);
      if (block) {
        done();
      }
    });
    it("비동기 블록 채굴(POW)", (done) => {
      blockchain.pendingTransactions = [];
      const tx = new Transaction(k1Public, k2Public, 0);
      tx.signTransaction(k1Key);
      blockchain.addTransaction(tx);

      blockchain.minePendingTransactionsAsync(k1Public, (block) => {
        if (block) {
          done();
        }
      });
    });
  });
});
