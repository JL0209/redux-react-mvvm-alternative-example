import { autorun } from 'mobx'
import ControlPanelVm from '../components/ControlPanelVm'

import { AppState, WebSocketState } from '../states'
import { ApiService } from '../services/ApiService'

jest.mock('../services/ApiService')

const mockGetFavSymbols = jest.fn(() => ['abcxyz'])

const stateConstruction = () => {
  const appState = new AppState({ apiService: new ApiService() })
  const webSocketState = new WebSocketState('echo.websocket.org', 8443)
  const vm = new ControlPanelVm({ appState, webSocketState })
  return { appState, webSocketState, vm }
}

describe('ControlPanelVm', () => {
  ApiService.mockImplementation(() => ({
    getFavSymbols: mockGetFavSymbols,
  }))

  it('onSelectDepth should getFavSymbols again and re-subscribe all topics', async () => {
    const { vm, appState } = stateConstruction()

    await new Promise((resolve) => {
      setTimeout(() => {
        expect(mockGetFavSymbols).toBeCalled()
        expect(mockGetFavSymbols.mock.calls.length).toBe(1) // fireImmediately
        expect(vm.depth).toBe(appState.depth)
        expect(vm.subscribedTopics).toContain('abcxyz@ticker')
        expect(vm.subscribedTopics).toContain('abcxyz@depth10')
        expect(vm.subscribedUrl).toContain('wss://echo.websocket.org:8443/stream?streams=abcxyz@depth10/abcxyz@ticker')

        const newDepth = 5
        const event = { target: { value: newDepth } }
        vm.onSelectDepth(event)
        expect(vm.depth).toBe(newDepth)
        resolve()
      })
    })

    await new Promise((resolve) => {
      setTimeout(() => {
        expect(mockGetFavSymbols).toBeCalled()
        expect(mockGetFavSymbols.mock.calls.length).toBe(2) // fireImmediately and onDepthChange
        expect(vm.subscribedTopics).toContain('abcxyz@ticker')
        expect(vm.subscribedTopics).toContain('abcxyz@depth5')
        expect(vm.subscribedUrl).toContain('wss://echo.websocket.org:8443/stream?streams=abcxyz@depth5/abcxyz@ticker')
        resolve()
      })
    })

    return true
  })


  it('selectEventUidByTopic should be reactive', async () => {
    const { vm, webSocketState } = stateConstruction()

    await new Promise((resolve) => {
      setTimeout(() => {
        let reactiveEventUid = null

        // From MobX Doc:
        // Creates a named reactive view and keeps it alive, so that the view is always
        // updated if one of the dependencies changes, even when the view is not further used by something else.
        autorun(() => {
          reactiveEventUid = vm.selectEventUidByTopic('abcxyz@ticker')
        })

        expect(reactiveEventUid).toBe(undefined)

        webSocketState._handleMessage({
          data: JSON.stringify({ stream: 'abcxyz@ticker', data: { lastUpdateId: 'foo' } }),
        })

        expect(reactiveEventUid).toBe('foo')

        webSocketState._handleMessage({
          data: JSON.stringify({ stream: 'abcxyz@ticker', data: { E: 'bar' } }),
        })

        expect(reactiveEventUid).toBe('bar')

        resolve()
      })
    })

    return true
  })
})
