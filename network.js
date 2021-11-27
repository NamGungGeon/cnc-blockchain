const { Block, Blockchain, Transaction } = require("./types");
const { generateKey } = require("./keygen");

const {
  PeerCMD,
  CMD_REQUEST_FULLBLOCK,
  CMD_REQUEST_PTX,
  CMD_MAKE_BLOCK,
  CMD_MAKE_PTX,
  CMD_RECV_NEW_PROBLEM,
  CMD_SEND_ANSWER,
  CMD_RECV_MY_HASH,
  CMD_RECV_REAL_HASH,
} = require("./network-cmd");

const blockchain = new Blockchain();
const conns = [];
const peerCMD = new PeerCMD(blockchain, conns);
peerCMD.keyPair = generateKey();
peerCMD.setCallback(() => {
  // console.log("handled", peerCMD.blockchain);
});
let peerCnt = 0;

const start = (
  onReady,
  socketAddr = "http://3.37.53.134:3003",
  peer = require("peerjs-nodejs")(undefined, {
    // host: "3.37.53.134",
    // path: "/peerjs",
    // port: "3004",
  })
) => {
  peer.on("open", (myId) => {
    console.log("peer is opened", myId);
    //id는 peerjs 에서 사용할 고유 id
    const io = require("socket.io-client");
    const socket = io(socketAddr);
    socket.on("connect", () => {
      console.log("socket is connected");
    });
    socket.on("roomId", (roomId) => {
      console.log("roomId", roomId);
      if (onReady) onReady();

      // initSocket(socket, roomId);
      socket.emit("join-room", roomId, myId);
    });
    let isSubmitAnswer = false;
    peerCMD.customActions.send[CMD_SEND_ANSWER] = (answer) => {
      if (isSubmitAnswer) {
        console.error("이미 해당 문제에 대한 답을 제출했습니다");
        return;
      }
      isSubmitAnswer = true;
      socket.emit(CMD_SEND_ANSWER, answer);
    };
    // setInterval(() => {
    //   peerCMD.sendCMD(CMD_SEND_ANSWER, 1);
    // }, 1000);
    peerCMD.customActions.recv[CMD_RECV_NEW_PROBLEM] = (problemImage) => {
      //show problemImage to user
      isSubmitAnswer = false;
      console.log("new problem is received!");
    };

    //enroll socket event
    socket.on(CMD_RECV_NEW_PROBLEM, (problemImage) => {
      peerCMD.receiveCMD(CMD_RECV_NEW_PROBLEM, problemImage);
    });
    socket.on(CMD_RECV_MY_HASH, (result) => {
      console.log("CMD_RECV_MY_HASH", result);
      peerCMD.receiveCMD(CMD_RECV_MY_HASH, result);
    });
    socket.on(CMD_RECV_REAL_HASH, (result) => {
      peerCMD.receiveCMD(CMD_RECV_REAL_HASH, result);
    });

    const connectPeer = (userId) => {
      if (userId === myId) return;

      const conn = peer.connect(userId);
      conn.serialization = "json";
      conn.on("open", () => {
        conns.push(conn);
        try {
          peerCMD.sendCMD(CMD_REQUEST_FULLBLOCK, null, conns);
        } catch (e) {
          console.error("sendCMD", e);
        }
        console.log("peer connected!", userId);
      });
      conn.on("data", (msg) => {
        console.log("peer: onData", msg);
        if (typeof msg === "object" && msg.cmd) {
          const { cmd, data } = msg;
          try {
            peerCMD.receiveCMD(cmd, data, peer);
            // if (cmd === CMD_REQUEST_FULLBLOCK && data) {
            //   const newBlock =
            //     blockchain.minePendingTransactions("test addr");
            //   peerCMD.sendCMD(CMD_MAKE_BLOCK, newBlock, conn);
            // }
          } catch (e) {
            console.error("onPeerCMDException", e);
          }
        } else {
          console.log("unknwon msg", msg, typeof msg);
        }
      });
      conn.on("close", () => {
        conns.splice(conns.indexOf(conn), 1);
        peerCnt--;
        console.log("peer is disconnected", userId);
      });

      return conn;
    };
    socket.on("user-list", ({ users, beforeHash: currentBlockHashKey }) => {
      console.log("on user-list", users, currentBlockHashKey);
      peerCMD.currentBlockHashKey = currentBlockHashKey;

      console.log("current users", users);
      peerCnt = users.length;

      if (peerCnt === 0) {
        // NOTE: There is no user!
        // MY CHAIN IS RIGHT. NO NEED VALIDATION
        return;
      }

      users.forEach(connectPeer);
    });
    socket.on("user-connected", (newUserId) => {
      console.log("on user-connected", newUserId);
      connectPeer(newUserId);
    });
    socket.on("disconnect", () => {
      console.log("socket is connected");
      while (conns.shift());
    });
  });
  // peer data send/receive rules
  // {cmd: '', data: '...'}
  peer.on("connection", function (conn) {
    // peerCMD.setConnection(conn);
    // conn.on("open", () => {});
    conn.on("data", (msg) => {
      console.log("onData", msg, typeof msg);
      //msg is cmd with data?
      if (typeof msg === "object" && msg.cmd) {
        const { cmd, data } = msg;
        try {
          peerCMD.receiveCMD(cmd, data, peer);
        } catch (e) {
          console.error("onPeerCMDException", e);
        }
      }
    });
  });

  return peerCMD;
};

// start();
//catch unCaughtException
process.on("uncaughtException", function (err) {
  console.error("uncaughtException (Node is alive)", err);
});

if (process.argv.indexOf("-start") !== -1) {
  start();
}

module.exports = {
  joinNetwork: start,
  CMD_REQUEST_FULLBLOCK,
  CMD_REQUEST_PTX,
  CMD_MAKE_BLOCK,
  CMD_MAKE_PTX,
  CMD_RECV_NEW_PROBLEM,
  CMD_SEND_ANSWER,
};
