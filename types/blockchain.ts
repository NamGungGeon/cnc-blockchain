import Block from "./block";
import Transaction from "./transaction";
import axios from "axios";

const wallets = require("../wallets");

export default class Blockchain {
  chain: Array<Block> = [];
  difficulty: number = 2;
  pendingTransactions: Array<Transaction> = [];
  miningReward = 100;

  attachNewBlock(block: Block) {
    //check block transactions are valid
    if (this.getLatestBlock().hash !== block.prevHash) {
      throw "이전 블록의 해시값과 현재 블록의 prevHash가 일치하지 않습니다";
    }

    let exception = null;
    block.transactions.map((tx: Transaction, idx: number) => {
      const { fromAddr, toAddr, amount, nft } = tx;
      if (idx === 0) {
        if (fromAddr !== null && amount !== this.miningReward) {
          exception = "채굴 보상 정보가 무효합니다";
        }
        return;
      }
      if (!fromAddr || !toAddr) {
        throw "보내는 사람 정보와 받는 사람 정보가 모두 존재해야 합니다";
      }

      if (
        block.transactions.find((itx: Transaction, iidx: number) => {
          return idx !== iidx && itx.fromAddr === tx.fromAddr;
        })
      ) {
        throw "한 블록에 한 사람이 여러 번 거래를 등록할 수 없습니다";
      }
      //tx 서명 검사
      tx.isValid();

      //nft 소유권 검사
      if (nft) {
        const owner = this.findNFTOwner(nft);
        if (!owner) {
          if (toAddr !== wallets.receptionist) {
            throw "처음 NFT를 생성하기 위해서는 반드시 지정된 지갑에 수수료를 지불해야 합니다";
          }
        } else {
          if (fromAddr !== owner) {
            throw "해당 토큰의 소유자가 아닙니다";
          }
        }
      }
      //잔고 검사
      if (amount) {
        if (this.getBalanceOfAddress(fromAddr) - amount < 0) {
          throw "잔액보다 더 많이 보낼 수 없습니다";
        }
      }
    });

    //ok
    this.chain.push(block);
  }

  findAllNFT(walletAddr: string): Array<string> {
    const nfts: Array<string> = [];
    this.chain.map((block, idx) => {
      if (idx === 0) return;

      block.transactions.map((tx: Transaction) => {
        if (!tx.nft) return;

        if (tx.toAddr === walletAddr) {
          nfts.push(tx.nft);
        } else if (tx.fromAddr === walletAddr) {
          if (tx.toAddr === wallets.receptionist) {
            nfts.push(tx.nft);
          } else {
            nfts.splice(nfts.indexOf(tx.nft), 1);
          }
        }
      });
    });

    return nfts;
  }
  findNFTOwner(nft: string): string | null {
    let owner = null;

    for (let i = this.chain.length - 1; i >= 0; i--) {
      const block = this.chain[i];
      for (let j = block.transactions.length - 1; j >= 0; j--) {
        const tx = block.transactions[j];
        if (tx.nft === nft) {
          if (tx.toAddr === wallets.receptionist) {
            owner = tx.fromAddr;
          } else {
            owner = tx.toAddr;
          }
        }
      }
      if (owner) break;
    }
    return owner;
  }
  minePendingTransactions(rewardAddress: string) {
    //예를 들어 비트코인에서는 현재 대기중인 모든 트랜잭션을 블록에 포함시키지는 않는다
    //비트코인에서 하나의 블록 사이즈는 1MB를 넘길 수 없으므로, 채굴자가 어떤 트랜잭션을 포함시킬지를 선택한다
    const block = new Block(
      Date.now(),
      this.pendingTransactions,
      this.getLatestBlock().hash
    );

    this.attachNewBlock(block);

    this.pendingTransactions = [
      new Transaction(null, rewardAddress, this.miningReward),
    ];

    return block;
  }
  minePendingTransactionsAsync(
    rewardAddress: string,
    onBlockMined: (block: Block | null) => void
  ) {
    const block = new Block(
      Date.now(),
      this.pendingTransactions,
      this.getLatestBlock().hash
    );
    block.miningAsync(this.difficulty, (block) => {
      // on mined
      if (this.getLatestBlock().hash === block.prevHash) {
        this.attachNewBlock(block);
        //ok miner is me
        //TODO: 현재 존재하는 pendingTransactions에서 블록에 포함된 tx전부 제거
        this.pendingTransactions = this.pendingTransactions.filter((ptx) => {
          const ptxsInBlock = block.transactions;
          return !ptxsInBlock.find(
            (ptxib) => ptxib.signiture === ptx.signiture
          );
        });

        this.pendingTransactions = [
          new Transaction(null, rewardAddress, this.miningReward),
          ...this.pendingTransactions,
        ];
        onBlockMined(block);
      } else {
        //other miner already mined (block is aborted)
        //require refreshing blockchain
        onBlockMined(null);
      }
    });
  }

  async addTransaction(transaction: Transaction): Promise<any> {
    if (!transaction.toAddr || !transaction.fromAddr) {
      throw "보내는 사람 정보와 받는 사람 정보가 모두 존재해야 합니다";
    }
    if (!transaction.isValid()) {
      throw "무효한 트랜잭션입니다";
    }
    if (
      this.pendingTransactions.find(
        (ptx) => ptx.fromAddr === transaction.fromAddr
      )
    ) {
      throw "이미 대기중인 거래가 있습니다";
    }
    if (transaction.nft) {
      const owner = this.findNFTOwner(transaction.nft);
      if (!owner && transaction.toAddr !== wallets.receptionist) {
        throw "처음 NFT를 생성하기 위해서는 반드시 지정된 지갑에 수수료를 지불해야 합니다";
      }

      if (owner && transaction.fromAddr !== owner) {
        throw "해당 토큰의 소유자가 아닙니다";
      }

      await axios
        .request({
          url: `http://3.37.53.134:3004/files/${transaction.nft}`,
          method: "GET",
        })
        .catch((e: Error) => {
          console.error(e);
          throw "서버에 해당 NFT에 해당하는 파일이 없습니다";
        });

      //보내는 데이터가 있는 경우 해당 데이터에서 계산된 수수료를 amount로 지정
      transaction.amount = transaction.calcFee();
    }

    //pendingTranscation에 포함된 거래내역에 대해 잔액 변동률 계산
    // let balanceDeltaFromPendingTransactions = 0;
    // this.pendingTransactions.map((tx) => {
    //   if (tx.fromAddr === transaction.fromAddr) {
    //     balanceDeltaFromPendingTransactions -= tx.amount;
    //   } else if (tx.toAddr === transaction.fromAddr) {
    //     balanceDeltaFromPendingTransactions += tx.amount;
    //   }
    // });
    if (
      this.getBalanceOfAddress(transaction.fromAddr) - transaction.amount <
      0
    ) {
      throw "잔액보다 더 많이 보낼 수 없습니다";
    }
    //can submit transcation to blockchain
    this.pendingTransactions.push(transaction);
  }
  getTransactionCountOfAddress(addr: string): number {
    //블록체인에 존재하는 트랜잭션에서 해당 주소로 된 트랜잭션이 있는지 탐색
    let txCnt = this.chain.reduce((acc, block, idx) => {
      if (idx === 0) return acc;
      let next = acc;
      block.transactions.forEach((tx) => {
        if (tx.toAddr === addr || tx.fromAddr === addr) next++;
      });

      return next;
    }, 0);
    //pendingTransactions에 해당 주소로 된 트랜잭션이 있는지 탐색
    this.pendingTransactions.forEach((tx) => {
      if (tx.toAddr === addr || tx.fromAddr === addr) txCnt++;
    });

    return txCnt;
  }

  createGenesisBlock(): Block {
    //이전 해시 "GenesisBlock", tx를 []로 임의로 지정
    return new Block(1633083312156, [], "genesisBlock");
  }
  getLatestBlock(): Block {
    return this.chain[this.chain.length - 1];
  }

  isValid(): boolean {
    //제네시스 블록은 이전 블록이 없어 검사를 건너뛰기 위해 1부터 시작한다.
    for (let i = 1; i < this.chain.length; i++) {
      const currentBlock = this.chain[i];
      const prevHash = this.chain[i - 1].hash;

      //블록에 포함된 모든 트랜잭션이 유효한지도 검사
      if (!currentBlock.hasValidTransactions()) {
        return false;
      }

      if (currentBlock.prevHash !== prevHash) {
        //현재 블록의 이전 해시값이 일치하지 않음
        return false;
      } else if (currentBlock.calcHash() !== currentBlock.hash) {
        //현재 블록에 저장된 해시값과 다시 계산한 해시값이 일치하지 않음
        return false;
      }
    }
    return true;
  }

  getBalanceOfAddress(addr: string): number {
    let balance = 0;
    this.chain.map((block, idx) => {
      if (idx === 0) {
        //genesis block은 생략한다
        return;
      }
      block.transactions.map((transcation) => {
        if (transcation.toAddr === addr) {
          balance += transcation.amount;
        }
        if (transcation.fromAddr === addr) {
          balance -= transcation.amount;
        }
      });
    });

    return balance;
  }
  static restore(json: Blockchain): Blockchain {
    const blockchain = new Blockchain();

    blockchain.chain = json.chain.map((block) => Block.restore(block));
    blockchain.difficulty = json.difficulty;
    blockchain.pendingTransactions = json.pendingTransactions.map((tx) =>
      Transaction.restore(tx)
    );
    blockchain.miningReward = json.miningReward;
    return blockchain;
  }
}

module.exports = Blockchain;
