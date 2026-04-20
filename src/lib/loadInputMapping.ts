import yaml from 'js-yaml'

import type { InputMapping } from '../domain/types'
import sampleGhYaml from '../mappings/input/sample-gh.yaml?raw'

export function loadSampleInputMapping(): InputMapping {
  return yaml.load(sampleGhYaml) as InputMapping
}
