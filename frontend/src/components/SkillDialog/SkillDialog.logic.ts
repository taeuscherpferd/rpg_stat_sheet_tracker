export class SkillDialogLogic {
  static parseTags(value: string): string[] {
    const tags: string[] = []
    for (const candidate of value.split(',')) {
      const tag = candidate.trim()
      if (
        tag !== '' &&
        !tags.some(
          (existingTag) =>
            existingTag.toLocaleLowerCase() === tag.toLocaleLowerCase(),
        )
      ) {
        tags.push(tag)
      }
    }
    return tags
  }
}
