const { default: axios } = require("axios");
const { Block, Blockchain, Transaction } = require("./types");

const CMD_REQUEST_FULLBLOCK = "request-fullblock";
const CMD_REQUEST_PTX = "request-penddingtx";
const CMD_MAKE_PTX = "make-penddingtx";

//TODO: 블록 생성 규칙 추가
//ex: 블록이 포함하는 트랜잭션의 최소 갯수
//ex: 블록 생성 주기
const CMD_MAKE_BLOCK = "make-block";

const CMD_RECV_NEW_PROBLEM = "NEW_PROBLEM";
const CMD_SEND_ANSWER = "ANSWER";

const CMD_RECV_MY_HASH = "USER_HASH";
const CMD_RECV_REAL_HASH = "REAL_HASH";

const PeerCMD = function (blockchain, conns) {
  if (!blockchain) {
    throw "blockchain is null";
  }
  this.conns = conns;
  this.blockchain = blockchain;

  //TODO: POB
  //MAKE_BLOCK 커맨드로 블록이 입력된 순서대로 array에 추가
  //추후 RECV_REAL_HASH값이 오면 pendingBlocks에서 가장 먼저 hash가 일치하는 블록을 채택
  this.pendingBlocks = [];

  this.currentBlockHashKey = "";

  this.customActions = {
    send: {},
    recv: {},
  };
  Object.seal(this.customActions);
};

PeerCMD.prototype.setCallback = function (callback) {
  this.handleCallback = callback;
};
PeerCMD.prototype.broadCastToPeers = function (handle = (conn) => {}) {
  if (this.conns) {
    this.conns.forEach(handle);
  }
};
PeerCMD.prototype.receiveCMD = async function (cmd, data, peer) {
  if (cmd === CMD_RECV_NEW_PROBLEM) {
    console.log("receiveCMD", cmd);
  } else {
    console.log("receiveCMD", cmd, data);
  }

  switch (cmd) {
    case CMD_REQUEST_FULLBLOCK:
      if (!data) {
        this.broadCastToPeers((conn) =>
          conn?.send(this.makeCMD(CMD_REQUEST_FULLBLOCK, this.blockchain))
        );
        break;
      }
      if (!this.currentBlockHashKey) {
        console.log("아직 최신 블록의 key가 로드되지 않았습니다");
        //잠시 후 다시 시도
        const receiveCMD = this.receiveCMD;
        setTimeout(() => receiveCMD(cmd, data, peer));
        return;
      }
      const blockchain = Blockchain.restore(data);
      //POB로 변경 후 블록 선택 방식 변경
      if (blockchain.isValid()) {
        if (blockchain.getLatestBlock().key !== this.currentBlockHashKey) {
          //최신 블록이 아님
          throw `최신 블록의 key값이 아닙니다 (${
            blockchain.getLatestBlock().key
          },${this.currentBlockHashKey})`;
        }
        if (blockchain.chain.length > this.blockchain.chain.length) {
          //가장 긴 블록 선택
          //set property of blockchain to received blockchain (overwrite)
          this.blockchain = blockchain;
        } else {
          //더 짧은 블록을 보낸 피어에게 가지고 있는 블록 전송
          // peer?.send(this.makeCMD(CMD_REQUEST_FULLBLOCK, this.blockchain));
          console.log("received chain is shorter(or equal) than local chain");
        }
      } else {
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
        // peer?.disconnect();
        throw "올바르지 않은 트랜잭션이 포함되어 있습니다";
      });

      break;
    case CMD_MAKE_PTX:
      const tx = Transaction.restore(data);
      if (!tx.isValid()) {
        //invalid transaction은 즉시 연결을 끊는다
        // peer?.disconnect();
        throw "무효한 트랜잭션입니다";
      }
      await this.blockchain.addTransaction(tx);
      break;
    case CMD_MAKE_BLOCK:
      const block = Block.restore(data.block);
      const miner = data.miner;

      if (
        this.pendingBlocks.find(({ miner: blockMiner }) => blockMiner === miner)
      ) {
        //동일한 채굴자로부터 여러 개의 블록이 제출됨
        // peer?.disconnect();
        throw "블록은 한 번만 제출할 수 있습니다 ";
      }
      //new block is pending state
      //waiting CMD_RECV_REAL_HASH
      if (block.hasValidTransactions())
        this.pendingBlocks.push({ block, miner });
      break;
    case CMD_RECV_MY_HASH:
      //make new block and propagate it
      const myHash = data;
      //use myHash when you mine new block
      const myBlock = new Block(
        new Date().getTime(),
        this.blockchain.pendingTransactions,
        this.blockchain.getLatestBlock().hash
      );
      myBlock._mining(myHash);

      this.sendCMD(CMD_MAKE_BLOCK, {
        block: myBlock,
        miner: this.keyPair.getPublic("hex"),
      });
      break;
    case CMD_RECV_REAL_HASH:
      console.log(CMD_RECV_REAL_HASH, this.pendingBlocks);
      //check pendingBlocks and select valid block
      this.currentBlockHashKey = data;
      const pendingBlocks = this.pendingBlocks.filter(({ block }) => {
        return block.key === this.currentBlockHashKey;
      });
      //첫 번째 블록부터 차례로 블록체인에 붙이기를 시도한다.
      for (let i = 0; i < pendingBlocks.length; i++) {
        const { block, miner } = pendingBlocks[i];
        console.log("attention!!", this.blockchain.pendingTransactions, block);
        try {
          this.blockchain.attachNewBlock(block);
          this.blockchain.pendingTransactions = [
            new Transaction(null, miner, this.blockchain.miningReward),
            ...this.blockchain.pendingTransactions,
          ];
          console.log(
            new Transaction(null, miner, this.blockchain.miningReward)
          );
          //블록 붙이기에 성공하면 루프를 종료한다
          break;
        } catch (e) {
          console.error(e);
        }
      }
      this.pendingBlocks = [];
      break;
    default:
      if (this.customActions.recv[cmd]) {
        this.customActions.recv[cmd](data);
        break;
      }

      // peer?.disconnect();
      throw "unknown cmd";
  }
  console.log("recv handled", this.blockchain);
  if (this.handleCallback) this.handleCallback("receive", cmd, data);
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
      const { block: _block, miner } = data;
      console.log(CMD_MAKE_BLOCK, data);
      const block = Block.restore(_block);
      if (!(block instanceof Block)) {
        throw "invalid block data";
      }
      if (!miner) {
        throw "miner is not defined";
      }
      console.log("pendingBlocks", this.pendingBlocks);
      this.pendingBlocks.push({ block, miner });
      this.broadCastToPeers((conn) =>
        conn?.send(this.makeCMD(CMD_MAKE_BLOCK, { block, miner }))
      );
      break;
    default:
      if (this.customActions.send[cmd]) {
        this.customActions.send[cmd](data);
        break;
      }
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
  CMD_RECV_NEW_PROBLEM,
  CMD_SEND_ANSWER,
  CMD_RECV_MY_HASH,
  CMD_RECV_REAL_HASH,
};
