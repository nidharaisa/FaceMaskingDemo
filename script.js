// Generate random room name if needed
if (!location.hash) {
  location.hash = Math.floor(Math.random() * 0xFFFFFF).toString(16);
}
const roomHash = location.hash.substring(1);

// TODO: Replace with your own channel ID
const drone = new ScaleDrone('yiS12Ts5RdNhebyM');
// Room name needs to be prefixed with 'observable-'
const roomName = 'observable-' + roomHash;
const configuration = {
  iceServers: [
    {
    urls: 'stun:stun.l.google.com:19302'
    } /*,
    {
    urls: 'turn:turn.anyfirewall.com:443?transport=tcp',
    credential: 'webrtc',
    username: 'webrtc'
    } */
  ]
};
let room;
let pc;


function onSuccess() {};
function onError(error) {
  console.error(error);
};

drone.on('open', error => {
  if (error) {
    return console.error(error);
  }
  room = drone.subscribe(roomName);
  room.on('open', error => {
    if (error) {
      onError(error);
    }
  });
  // We're connected to the room and received an array of 'members'
  // connected to the room (including us). Signaling server is ready.
  room.on('members', members => {
    console.log('MEMBERS', members);
    // If we are the second user to connect to the room we will be creating the offer
    const isOfferer = members.length === 2;
    startWebRTC(isOfferer);
  });
});

// Send signaling data via Scaledrone
function sendMessage(message) {
  drone.publish({
    room: roomName,
    message
  });
}

var mediaStream;
var isSetRemoteCandi;

function startWebRTC(isOfferer) {
  pc = new RTCPeerConnection(configuration);
  isSetRemoteCandi = false;

  // 'onicecandidate' notifies us whenever an ICE agent needs to deliver a
  // message to the other peer through the signaling server
  pc.onicecandidate = event => {
    if (event.candidate) {
      sendMessage({'candidate': event.candidate});
      console.log("ice candi event");
    }
  };

  // If user is offerer let the 'negotiationneeded' event create the offer
  if (isOfferer) {
    pc.onnegotiationneeded = () => {
      pc.createOffer().then(localDescCreated).catch(onError);
      console.log("offer created");
    }
  }

  // When a remote stream arrives display it in the #remoteVideo element
  pc.ontrack = event => {
    const stream = event.streams[0];
    if (!remoteVideo.srcObject || remoteVideo.srcObject.id !== stream.id) {
      remoteVideo.srcObject = stream;
    }
  };
    
// getUserMedia modify
/*    
    navigator.getUserMedia = navigator.getUserMedia ||
                         navigator.webkitGetUserMedia ||
                         navigator.mozGetUserMedia;
        
        
    if(navigator.getUserMedia) {
        const constraints = { audio: false, video: true };
        navigator.getUserMedia(constraints, faceMask, onError);

        var canvas = document.getElementById('localCanvas');
        
        if(canvas) {
            console.log("canvas found to capture");
        }
        mediaStream = canvas.captureStream(25);
        if(mediaStream) {
            pc.addStream(mediaStream);
        }
        else {
            stream.getTracks().forEach(track => pc.addTrack(track, faceMask(stream)));
        }
    }
    else{
        console.log("Browser not supoorted!!!");
    }
*/
    
  navigator.mediaDevices.getUserMedia({
    audio: false,
    video: true,
  }).then(stream => {
    // Display your local video in #localVideo element
    localVideo.srcObject = stream;

    // face mask here
    faceMask(stream);
      
    var canvas = document.getElementById('localCanvas');
      
    if(canvas) {
        console.log("canvas found!!");
              
        mediaStream = canvas.captureStream(25);
        pc.addStream(mediaStream);
    }else {
        console.log("canvas NOT found!!");
        // Add your stream to be sent to the conneting peer
        stream.getTracks().forEach(track => pc.addTrack(track, faceMask(stream)));
    }

  }, onError);

    
  // Listen to signaling data from Scaledrone
  room.on('data', (message, client) => {
    // Message was sent by us
    if (client.id === drone.clientId) {
      return;
    }

    if (message.sdp) {
        
        console.log("message SDP received. " + message.sdp);
      // This is called after receiving an offer or answer from another peer
      pc.setRemoteDescription(new RTCSessionDescription(message.sdp), () => {
        // When receiving an offer lets answer it
        if (pc.remoteDescription.type === 'offer') {
          pc.createAnswer().then(localDescCreated).catch(onError);
        }
      }, onError);
    } else if (message.candidate) {
        console.log("candi info received. " + message.candidate);
      // Add the new ICE candidate to our connections remote description
      pc.addIceCandidate(
        new RTCIceCandidate(message.candidate), onSuccess, onError
      );
    }
    else {
        console.log("SDP or candidate nothing specified!!");
    }
  });
}

function localDescCreated(desc) {
  pc.setLocalDescription(
    desc,
    () => sendMessage({'sdp': pc.localDescription}),
    onError
  );
}

function faceMask(stream) {
    
    console.log("stream found!!!");
    localVideo.srcObject = stream;
    
    var video = document.getElementById('localVideo');
    var canvas = document.getElementById('localCanvas');
    var context = canvas.getContext('2d');

    // set tracker option
    var tracker = new tracking.ObjectTracker('face');
    tracker.setInitialScale(4);
    tracker.setStepSize(2);
    tracker.setEdgesDensity(0.1);

    tracking.track('#localVideo', tracker);

    tracker.on('track', function(event) {
        
        // console.log(peer + " track successful!!!");
        
        var mask = new Image();
        mask.src = "smiley.jpg";

        
        context.clearRect(0, 0, canvas.width, canvas.height);
        // context.drawImage(document.getElementById('localVideo'), 0, 0, canvas.width, canvas.height);

        event.data.forEach(function(rect) {

            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            context.fillStyle = "#f5f";
            // context.fillRect(rect.x, rect.y, rect.width, rect.height); 
            context.drawImage(mask, rect.x, rect.y, rect.width, rect.height);
        });
      });
    
    // return canvas.captureStream(25);
}
