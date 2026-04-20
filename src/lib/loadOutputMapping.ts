import yaml from 'js-yaml'

import sampleOutputYaml from '../mappings/output/sample-gh-output.yaml?raw'

export type OutputMapping = {
  name: string
  municipality: string
  sheet: string
  staffStartRow: number
  columns: {
    name: string
    position: string
    weeklyHours: string
    fte: string
  }
}

export function loadSampleOutputMapping(): OutputMapping {
  return yaml.load(sampleOutputYaml) as OutputMapping
}
