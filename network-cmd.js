const { default: axios } = require("axios");
const { Block, Blockchain, Transaction } = require("./types");

const CMD_REQUEST_FULLBLOCK = "request-fullblock";
const CMD_REQUEST_PTX = "request-penddingtx";
const CMD_MAKE_PTX = "make-penddingtx";
const CMD_MAKE_BLOCK = "make-block";

const PeerCMD = function (blockchain, conns) {
  if (!blockchain) {
    throw "blockchain is null";
  }
  this.conns = conns;
  this.blockchain = blockchain;
};

// PeerCMD.prototype.setConnection = function (conn) {
//   this.conn = conn;
// };

PeerCMD.prototype.setCallback = function (callback) {
  this.handleCallback = callback;
};
PeerCMD.prototype.broadCastToPeers = function (handle = (conn) => {}) {
  if (this.conns) {
    this.conns.forEach(handle);
  }
};
PeerCMD.prototype.receiveCMD = async function (cmd, data, peer) {
  console.log("receiveCMD", cmd, data);
  switch (cmd) {
    case CMD_REQUEST_FULLBLOCK:
      if (!data) {
        this.broadCastToPeers((conn) =>
          conn?.send(this.makeCMD(CMD_REQUEST_FULLBLOCK, this.blockchain))
        );
        break;
      }
      const blockchain = Blockchain.restore(data);
      if (blockchain.isValid()) {
        //가장 긴 블록 선택
        if (blockchain.chain.length > this.blockchain.chain.length) {
          //set property of blockchain to received blockchain (overwrite)
          this.blockchain = blockchain;
        } else {
          //더 짧은 블록을 보낸 피어에게 가지고 있는 블록 전송
          // peer?.send(this.makeCMD(CMD_REQUEST_FULLBLOCK, this.blockchain));
          console.log("received chain is shorter(or equal) than local chain");
        }
      } else {
        peer?.disconnect();
        throw "invalid blockchain is received";
      }
      break;
    case CMD_REQUEST_PTX:
      if (!data) {
        this.broadCastToPeers((conn) =>
          conn?.send(
            this.makeCMD(CMD_REQUEST_PTX, this.blockchain.pendingTransactions)
          )
        );
        break;
      }
      const pendingTransactions = data.map((tx) => {
        return Transaction.restore(tx);
      });
      await Promise.all(
        pendingTransactions.map(async (tx) => {
          if (
            !this.blockchain.pendingTransactions.find(
              (ptx) => ptx.signiture === tx.signiture
            )
          ) {
            await this.blockchain.addTransaction(tx);
          }
        })
      ).catch((e) => {
        console.error(e);
        throw "올바르지 않은 트랜잭션이 포함되어 있습니다";
      });

      break;
    case CMD_MAKE_PTX:
      const tx = Transaction.restore(data);
      if (!tx.isValid()) {
        //invalid transaction은 즉시 연결을 끊는다
        peer?.disconnect();
        throw "무효한 트랜잭션입니다";
      }
      await this.blockchain.addTransaction(tx);
      break;
    case CMD_MAKE_BLOCK:
      const block = Block.restore(data.block);
      if (
        !block.isValid(
          this.blockchain.getLatestBlock(),
          this.blockchain.difficulty
        )
      ) {
        throw "올바르지 않은 블록입니다";
      }
      const miner = data.miner;
      //TODO: 현재 존재하는 pendingTransactions에서 블록에 포함된 tx전부 제거
      this.blockchain.pendingTransactions =
        this.blockchain.pendingTransactions.filter((ptx) => {
          const ptxsInBlock = block.transactions;
          return !ptxsInBlock.find(
            (ptxib) => ptxib.signiture === ptx.signiture
          );
        });
      //채굴 보상 등록
      this.blockchain.pendingTransactions = [
        new Transaction(null, miner, this.blockchain.miningRewrad),
        ...this.blockchain.pendingTransactions,
      ];
      this.blockchain.attachNewBlock(block);
      break;
    default:
      throw "unknown cmd";
  }
  console.log("recv handled", this.blockchain);
  if (this.handleCallbaclk) this.handleCallback("receive", cmd, data);
};
PeerCMD.prototype.sendCMD = async function (cmd, data) {
  console.log("sendCMD", cmd, data);
  switch (cmd) {
    case CMD_REQUEST_FULLBLOCK:
      this.broadCastToPeers((conn) =>
        conn?.send(this.makeCMD(CMD_REQUEST_FULLBLOCK, null))
      );
      break;
    case CMD_REQUEST_PTX:
      this.broadCastToPeers((conn) =>
        conn?.send(this.makeCMD(CMD_REQUEST_PTX, null))
      );
      break;
    case CMD_MAKE_PTX:
      const tx = data;
      if (!(tx instanceof Transaction)) {
        throw "invalid transaction data";
      }
      await this.blockchain.addTransaction(tx);
      this.broadCastToPeers((conn) =>
        conn?.send(this.makeCMD(CMD_MAKE_PTX, tx))
      );
      break;
    case CMD_MAKE_BLOCK:
      const { block, miner } = data;
      if (!(block instanceof Block)) {
        throw "invalid block data";
      }
      if (!miner) {
        throw "miner is not defined";
      }
      this.broadCastToPeers((conn) =>
        conn?.send(this.makeCMD(CMD_MAKE_BLOCK, { block, miner }))
      );
      break;
    default:
      throw "unknown cmd";
  }
  if (this.handleCallback) this.handleCallback("send", cmd, data);
};
PeerCMD.prototype.makeCMD = function (cmd, data) {
  return { cmd, data };
};

module.exports = {
  PeerCMD,
  CMD_REQUEST_FULLBLOCK,
  CMD_REQUEST_PTX,
  CMD_MAKE_BLOCK,
  CMD_MAKE_PTX,
};
