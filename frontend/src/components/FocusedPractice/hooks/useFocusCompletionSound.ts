import { useCallback, useEffect, useRef } from 'react'

export interface FocusCompletionSound {
  play: () => Promise<void>
  prepare: () => Promise<void>
}

export const useFocusCompletionSound = (): FocusCompletionSound => {
  const audioContextRef = useRef<AudioContext | null>(null)

  const prepare = useCallback(async () => {
    try {
      const context = audioContextRef.current ?? new AudioContext()
      audioContextRef.current = context
      if (context.state === 'suspended') await context.resume()
    } catch {
      console.error('Unable to prepare the focus completion sound')
    }
  }, [])

  const play = useCallback(async () => {
    await prepare()
    const context = audioContextRef.current
    if (context === null || context.state !== 'running') return

    const startTime = context.currentTime
    const gain = context.createGain()
    gain.gain.setValueAtTime(0.0001, startTime)
    gain.gain.exponentialRampToValueAtTime(0.22, startTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 1.1)
    gain.connect(context.destination)

    const frequencies = [523.25, 659.25, 783.99]
    frequencies.forEach((frequency, index) => {
      const oscillator = context.createOscillator()
      const noteStart = startTime + index * 0.14
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(frequency, noteStart)
      oscillator.connect(gain)
      oscillator.start(noteStart)
      oscillator.stop(startTime + 1.1)
    })
  }, [prepare])

  useEffect(
    () => () => {
      if (audioContextRef.current !== null) void audioContextRef.current.close()
    },
    [],
  )

  return { play, prepare }
}
