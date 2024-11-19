import json
import asyncio
import websockets
import aiortc 

async def connect(websocket):
    config = aiortc.RTCConfiguration([aiortc.RTCIceServer('stun:stun.l.google.com:19302')])
    pc = aiortc.RTCPeerConnection(configuration=config)

    # Monitor connection state changes
    @pc.on("connectionstatechange")
    async def on_connection_state_change():
        print(f"Connection state is {pc.connectionState}")
    
    try:
        async for message in websocket:
            data = json.loads(message)

            if 'new-ice-candidate' in data:
                candidate_info = data['new-ice-candidate']
                ice_candidate = aiortc.RTCIceCandidate(
                    component = candidate_info['component'],
                    foundation = candidate_info['foundation'],
                    ip=candidate_info['address'],
                    port=candidate_info['port'],
                    priority=candidate_info['priority'],
                    protocol=candidate_info['protocol'],
                    type=candidate_info['type'],
                    relatedAddress=candidate_info['relatedAddress'],
                    relatedPort=candidate_info['relatedPort'],
                    sdpMid=candidate_info['sdpMid'],
                    sdpMLineIndex=candidate_info['sdpMLineIndex'],
                    tcpType=candidate_info['tcpType']
                )
                await pc.addIceCandidate(ice_candidate)
                print("[ICE CANDIDATE ADDED]")

            if 'offer' in data:
                print("[OFFER ARRIVED]")
                offer = data['offer']

                offer = aiortc.RTCSessionDescription(sdp=offer['sdp'], type=offer['type'])
                await pc.setRemoteDescription(offer)

                answer = await pc.createAnswer()
                await pc.setLocalDescription(answer)

                print("[SENDING BACK ANSWER]")
                await websocket.send(json.dumps({
                    'type': answer.type,
                    'sdp': answer.sdp,
                }))
                
                

    except websockets.exceptions.ConnectionClosed as e:
        print(f"Connection closed: {e}")

    finally:
        await pc.close()

async def main():
    server = await websockets.serve(connect, "localhost", 8765)
    print("WebSocket server is running on ws://localhost:8765")
    await server.wait_closed()

asyncio.run(main())