import json
import asyncio
import aiortc.contrib
import aiortc.contrib.media
import websockets
import aiortc 

relay = aiortc.contrib.media.MediaRelay()
pcs = set()

class VideoStreamTrack(aiortc.MediaStreamTrack):
    kind='video'    # è obbligatorio fare questo, wow
    def __init__(self, track):
        super().__init__()  
        self.track = track

    async def recv(self):
        frame = await self.track.recv()
        print(frame)
        return frame

async def receiveOffer(websocket):
    try:
        async for message in websocket:
            print("[OFFER RECEIVED]")

            json_offer = json.loads(message)
            offer = aiortc.RTCSessionDescription(sdp=json_offer['sdp'], type=json_offer['type'])
            pc = aiortc.RTCPeerConnection()
            pcs.add(pc)

            @pc.on("track")
            def on_track(track):
                print("Track received: "+track.kind)
                if track.kind=='video':
                    pc.addTrack(VideoStreamTrack(relay.subscribe(track)))

            @pc.on("connectionstatechange")
            async def on_connectionstatechange():
                print("Connection state is: "+str(pc.connectionState))
                if pc.connectionState == "failed":
                    await pc.close()
                    pcs.discard(pc)

            # handle offer
            await pc.setRemoteDescription(offer)
            answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)

            await websocket.send(json.dumps({
                'type': answer.type,
                'sdp': answer.sdp
            }))
            print("[ANSWER SENT]")


    except websockets.exceptions.ConnectionClosed as e:
        print(f"Connection closed: {e}")

    finally:
        await pc.close()

async def on_shutdown():
    coros = [pc.close() for pc in pcs]
    await asyncio.gather(*coros)
    pcs.clear()

async def main():
    server = await websockets.serve(receiveOffer, "localhost", 8765)
    print("WebSocket server is running on ws://localhost:8765")
    await server.wait_closed()
    await on_shutdown()

asyncio.run(main())