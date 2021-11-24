const { Block, Blockchain, Transaction } = require("./types");

const {
  PeerCMD,
  CMD_REQUEST_FULLBLOCK,
  CMD_REQUEST_PTX,
  CMD_MAKE_BLOCK,
  CMD_MAKE_PTX,
  CMD_RECV_NEW_PROBLEM,
  CMD_SEND_ANSWER,
  CMD_RECV_ANSWER_VALID,
} = require("./network-cmd");
const { joinNetwork } = require(".");

const blockchain = new Blockchain();
const conns = [];
const peerCMD = new PeerCMD(blockchain, conns);
peerCMD.setCallback(() => {
  console.log("handled", peerCMD.blockchain);
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
    peerCMD.customActions.send[CMD_SEND_ANSWER] = (answer) => {
      socket.emit(CMD_SEND_ANSWER, answer);
    };
    peerCMD.customActions.recv[CMD_RECV_NEW_PROBLEM] = (problemImage) => {
      //some action
    };
    peerCMD.customActions.recv[CMD_RECV_ANSWER_VALID] = (result) => {
      //some action
    };
    socket.on(CMD_RECV_NEW_PROBLEM, (problemImage) => {
      peerCMD.receiveCMD(CMD_RECV_NEW_PROBLEM, problemImage);
    });
    socket.on(CMD_RECV_ANSWER_VALID, (result) => {
      peerCMD.receiveCMD(CMD_RECV_ANSWER_VALID, result);
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
            peerCMD.receiveCMD(cmd, data, conn);
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
    socket.on("user-list", (_users) => {
      console.log("on user-list");
      const users = JSON.parse(_users);
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
          peerCMD.receiveCMD(cmd, data, conn);
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

if (process.argv.indexOf("-start")) {
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
