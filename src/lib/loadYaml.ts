import yaml from 'js-yaml'

export function loadYaml<T>(rawYaml: string, sourceName: string): T {
  const parsed = yaml.load(rawYaml)
  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`${sourceName} の読み込みに失敗しました`)
  }
  return parsed as T
}
