const { Block, Blockchain, Transaction } = require("./blockchain");

const CMD_REQUEST_FULLBLOCK = "request-fullblock";
const CMD_REQUEST_PTX = "request-penddingtx";
const CMD_MAKE_PTX = "make-penddingtx";
const CMD_MAKE_BLOCK = "make-block";

const PeerCMD = function (blockchain) {
  if (!blockchain) {
    throw "blockchain is null";
  }
  this.blockchain = blockchain;
};
PeerCMD.prototype.receiveCMD = function (cmd, data, conn) {
  console.log("receiveCMD", cmd, data);
  switch (cmd) {
    case CMD_REQUEST_FULLBLOCK:
      if (!data) {
        conn.send(this.makeCMD(CMD_REQUEST_FULLBLOCK, this.blockchain));
        return;
      }
      const blockchain = Blockchain.restore(data);
      if (blockchain.isValid()) {
        if (blockchain.chain.length > this.blockchain.chain.length) {
          //set property of blockchain to received blockchain (overwrite)
          this.blockchain.chain = blockchain.chain;
          this.blockchain.difficulty = blockchain.difficulty;
          this.blockchain.pendingTransactions = blockchain.pendingTransactions;
          this.blockchain.miningRewrad = blockchain.miningRewrad;
        } else {
          //가장 긴 블록 선택
          console.log("received chain is shorter(or equal) than local chain");
        }
      } else {
        throw "invalid blockchain is received";
      }
      break;
    case CMD_REQUEST_PTX:
      if (!data) {
        conn.send(
          this.makeCMD(
            CMD_REQUEST_PTX,
            JSON.stringify(this.blockchain.pendingTransactions)
          )
        );
        return;
      }
      const pendingTransactions = data.map((tx) => {
        return Transaction.restore(tx);
      });
      const txValid = pendingTransactions.every((tx) => tx.isValid());
      if (!txValid) {
        throw "올바르지 않은 트랜잭션이 포함되어 있습니다";
      }

      this.blockchain.pendingTransactions = pendingTransactions;
      break;
    case CMD_MAKE_PTX:
      const tx = Transaction.restore(data);
      if (!tx.isValid()) {
        throw "올바르지 않은 트랜잭션입니다";
      }
      this.blockchain.addTransaction(tx);
      break;
    case CMD_MAKE_BLOCK:
      const block = Block.restore(data);
      if (
        !block.isValid(
          this.blockchain.getLatestBlock(),
          this.blockchain.difficulty
        )
      ) {
        throw "올바르지 않은 블록입니다";
      }
      this.blockchain.chain.push(block);
      break;
    default:
      throw "unknown cmd";
  }
  console.log("recv handled", this.blockchain);
};
PeerCMD.prototype.sendCMD = function (cmd, data, conn) {
  console.log("sendCMD", cmd, data);
  switch (cmd) {
    case CMD_REQUEST_FULLBLOCK:
      conn.send(this.makeCMD(CMD_REQUEST_FULLBLOCK, null, conn));
      break;
    case CMD_REQUEST_PTX:
      conn.send(this.makeCMD(CMD_REQUEST_PTX, null, conn));
      break;
    case CMD_MAKE_PTX:
      if (!(data instanceof Transaction)) {
        throw "invalid transaction data";
      }
      conn.send(this.makeCMD(CMD_MAKE_PTX, data, conn));
      break;
    case CMD_MAKE_BLOCK:
      if (!(data instanceof Block)) {
        throw "invalid block data";
      }
      conn.send(this.makeCMD(CMD_MAKE_BLOCK, data, conn));
      break;
    default:
      throw "unknown cmd";
  }
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
