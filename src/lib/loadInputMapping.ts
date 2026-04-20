import type { InputMapping } from '../domain/types'
import inputMappingYaml from '../mappings/input/input_mapping.yaml?raw'
import { loadYaml } from './loadYaml'

export function loadInputMapping(): InputMapping {
  return loadYaml<InputMapping>(inputMappingYaml, 'input_mapping.yaml')
}
