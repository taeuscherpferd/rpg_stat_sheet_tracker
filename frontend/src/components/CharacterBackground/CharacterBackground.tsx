import { useId } from 'react'
import styles from './CharacterBackground.module.scss'

type CharacterBackgroundProps = {
  backgroundId: string
}

const palettes: Record<string, string[]> = {
  mountains: ['#9fb5b1', '#e0d1ad', '#aab6a5', '#788d7a', '#50624f'],
  forest: ['#77958a', '#dfd7b2', '#7e9c83', '#486b57', '#294a3c'],
  lake: ['#293f58', '#a0b6bf', '#758f9c', '#4e727e', '#334f58'],
  ruins: ['#c5a17d', '#f0d9ac', '#d1b180', '#b18b65', '#8b7157'],
  coast: ['#8fb4bb', '#e2dfc6', '#9fb7b0', '#6e928b', '#4c6a60'],
  stars: ['#121b34', '#443d68', '#655b91', '#34354f', '#242c3d'],
}

export const CharacterBackground = ({
  backgroundId,
}: CharacterBackgroundProps) => {
  const id = useId()
  const palette = palettes[backgroundId] ?? palettes.mountains
  const skyId = `${id}-sky`

  return (
    <div
      className={styles.background}
      aria-hidden="true"
      data-background={backgroundId}
    >
      <svg viewBox="0 0 520 420" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id={skyId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={palette[0]} />
            <stop offset="1" stopColor={palette[1]} />
          </linearGradient>
          <radialGradient id={`${id}-nebula`}>
            <stop offset="0" stopColor="#a19acb" stopOpacity="0.4" />
            <stop offset="1" stopColor="#625b98" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="520" height="420" fill={`url(#${skyId})`} />
        {backgroundId === 'mountains' && (
          <>
            <circle cx="418" cy="82" r="31" fill="#f2e4c1" opacity="0.68" />
            <path
              d="M0 292 51 224l37 37 75-123 37 42 82-134 91 144 64-91 82 128v193H0z"
              fill={palette[2]}
            />
            <path
              d="m242 115 40-69 46 74-31-20-17 16-14-19zM138 164l25-26 22 20-15-3-10 11-8-10zM348 190l28-38 29 37-18-8-12 11-12-12z"
              fill="#eee9d9"
              opacity="0.86"
            />
            <path
              d="M0 328 75 260l50 40 77-111 55 61 75-104 60 67 57-75 71 75v207H0z"
              fill={palette[3]}
            />
            <path
              d="m125 300 77-111 55 61-50-29-24 34-20-12zM332 213l60 67 57-75-38 71-37-19-21 26z"
              fill="#b0b39b"
              opacity="0.5"
            />
          </>
        )}
        {backgroundId === 'forest' && (
          <>
            <circle cx="290" cy="100" r="43" fill="#f0e4b4" opacity="0.65" />
            <path d="M0 286Q110 190 225 277T520 247V420H0z" fill={palette[2]} />
            <g fill={palette[3]}>
              <path d="m35 300 36-73H51l35-68H68l34-90 37 90h-18l35 68h-22l38 73zM345 312l35-76h-20l36-76h-16l37-99 38 99h-19l35 76h-20l39 76z" />
              <path
                d="m174 295 27-62h-15l30-65h-13l28-80 31 80h-14l29 65h-17l32 62z"
                opacity="0.55"
              />
            </g>
            <g fill={palette[4]}>
              <path d="M0 0h27l13 330H14zM472 0h29l19 341h-39z" />
              <path d="M0 0h155l-32 38-38-5-33 29L0 50zM356 0h164v69l-58-16-40-27-49 10z" />
            </g>
            <path
              d="M205 420q-4-58 47-111-15 61 69 111"
              fill="#d3c39a"
              opacity="0.55"
            />
          </>
        )}
        {backgroundId === 'lake' && (
          <>
            <g fill="#e7e5cd" opacity="0.8">
              <circle cx="58" cy="52" r="1.6" />
              <circle cx="184" cy="35" r="1.4" />
              <circle cx="276" cy="93" r="1.8" />
              <circle cx="452" cy="43" r="1.3" />
              <circle cx="106" cy="123" r="1.2" />
              <circle cx="393" cy="86" r="29" />
            </g>
            <path
              d="M0 260 70 167l67 72 92-129 81 128 71-79 139 107v154H0z"
              fill={palette[2]}
            />
            <path d="M0 274q100-26 206 4t314-9v151H0z" fill={palette[3]} />
            <path
              d="m377 280 33 0 12 17-53 0zm-12 32h61l19 7h-92zm-25 25h101l17 5H323z"
              fill="#d4d8c8"
              opacity="0.32"
            />
            <path
              d="M0 304 38 232l37 75 39-40 30 68-51 85H0zM520 303l-39-82-40 98-31-40-31 72 57 69h84z"
              fill={palette[4]}
            />
          </>
        )}
        {backgroundId === 'ruins' && (
          <>
            <circle cx="409" cy="88" r="36" fill="#f8e7bd" opacity="0.8" />
            <path d="M0 277q106-89 221-14t299-12v169H0z" fill={palette[2]} />
            <g fill={palette[3]} stroke="#d7bc92" strokeWidth="3">
              <path d="M63 306V140h29v-22h35v188zm-11-166v-18h83v18zM383 297V124h30v-21h29v194zm-10-173v-19h78v19z" />
              <path d="M173 306V175q0-69 68-69h34q68 0 68 69v131h-27V177q0-44-43-44h-30q-43 0-43 44v129z" />
            </g>
            <path
              d="m240 106-7 24 13 15-12 21m87 36 18 7M63 215h30m291-28h57"
              fill="none"
              stroke="#8c7053"
              strokeWidth="3"
            />
            <path d="M0 328q133-53 266-9t254-12v113H0z" fill="#dec69a" />
            <path
              d="m58 356 8-25h42l13 25zm333-9 9-22h30l12 22z"
              fill={palette[3]}
            />
          </>
        )}
        {backgroundId === 'coast' && (
          <>
            <circle cx="110" cy="83" r="31" fill="#f1e7c8" opacity="0.75" />
            <path d="M0 232h520v188H0z" fill={palette[2]} />
            <g fill="none" stroke="#e7ebd8" strokeWidth="3" opacity="0.5">
              <path d="M12 270h118m202-16h145M84 304h92m138 16h180m-268 27h99" />
            </g>
            <path
              d="m0 210 99 25 31 53 67 28-25 104H0zM520 164l-88 34-38 73-48 24 26 125h148z"
              fill={palette[3]}
            />
            <path
              d="m0 210 99 25 31 24-74-11-56-16zM520 164l-88 34-19 34 61-29 46-15z"
              fill={palette[4]}
            />
            <path d="m452 191 6-90h24l6 85z" fill="#e8dfc7" />
            <path d="m455 101 15-16 15 16z" fill="#8e6b54" />
            <path
              d="M259 104q9-9 18 0 9-9 18 0M326 133q7-7 14 0 7-7 14 0"
              fill="none"
              stroke={palette[4]}
              strokeWidth="2"
            />
          </>
        )}
        {backgroundId === 'stars' && (
          <>
            <ellipse
              cx="320"
              cy="165"
              rx="250"
              ry="160"
              fill={`url(#${id}-nebula)`}
            />
            <path
              d="M-40 242Q112 33 288 145T560 34"
              fill="none"
              stroke="#9e91bf"
              strokeWidth="42"
              opacity="0.09"
            />
            <g fill="#f3edd9">
              {[
                [31, 30, 1.6],
                [67, 83, 2.1],
                [116, 25, 1.2],
                [156, 103, 1.6],
                [193, 42, 2],
                [240, 18, 1.2],
                [278, 82, 1.4],
                [327, 28, 2.1],
                [377, 54, 1.3],
                [424, 21, 1.7],
                [477, 76, 2],
                [506, 124, 1.3],
                [26, 151, 1.4],
                [86, 182, 1.8],
                [132, 143, 1.2],
                [216, 152, 1.6],
                [306, 139, 1.3],
                [356, 194, 2],
                [411, 147, 1.2],
                [462, 208, 1.8],
                [38, 264, 1.9],
                [116, 238, 1.4],
                [170, 289, 1.6],
                [280, 241, 1.4],
                [338, 286, 1.2],
                [405, 264, 1.8],
                [487, 312, 1.5],
                [73, 328, 1.4],
              ].map(([x, y, radius]) => (
                <circle key={`${x}-${y}`} cx={x} cy={y} r={radius} />
              ))}
              <path d="m105 100 3 10 10 3-10 3-3 10-3-10-10-3 10-3zM398 87l3 11 11 3-11 3-3 11-3-11-11-3 11-3zM440 236l2 8 8 2-8 2-2 8-2-8-8-2 8-2z" />
            </g>
            <path
              d="M0 349 48 319l55 24 79-41 66 48 92-36 61 32 74-38 45 35v77H0z"
              fill={palette[3]}
            />
          </>
        )}
        <path d="M0 372q85-35 172-8t176-1 172 3v54H0z" fill={palette[4]} />
        <path
          d="M0 393q120-20 253-3t267-2v32H0z"
          fill={palette[1]}
          opacity="0.12"
        />
      </svg>
    </div>
  )
}
