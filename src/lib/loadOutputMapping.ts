import outputMappingYaml from '../mappings/output/output_mapping.yaml?raw'
import { loadYaml } from './loadYaml'

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

export function loadOutputMapping(): OutputMapping {
  return loadYaml<OutputMapping>(outputMappingYaml, 'output_mapping.yaml')
}
