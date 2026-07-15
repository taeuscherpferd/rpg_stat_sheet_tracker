export class AppLogic {
  static today(): string {
    const date = new Date()
    const offset = date.getTimezoneOffset() * 60_000
    return new Date(date.getTime() - offset).toISOString().slice(0, 10)
  }

  static suggestCode(name: string): string {
    const words = name.toUpperCase().match(/[A-Z0-9]+/g) ?? []
    if (words.length >= 3)
      return words
        .slice(0, 3)
        .map((word) => word[0])
        .join('')
    if (words.length === 2)
      return `${words[0]?.[0] ?? ''}${(words[1] ?? '').slice(0, 2)}`.padEnd(
        3,
        'X',
      )
    const word = words[0] ?? ''
    const consonants = `${word[0] ?? ''}${word.slice(1).replace(/[AEIOU]/g, '')}`
    return (consonants + word + 'XXX').slice(0, 3)
  }
}
