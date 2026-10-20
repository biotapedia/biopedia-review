export const rankNames = {
  domain: '域', kingdom: '界', subkingdom: '亚界', phylum: '门', subphylum: '亚门',
  class: '纲', subclass: '亚纲', order: '目', suborder: '亚目', family: '科',
  subfamily: '亚科', tribe: '族', genus: '属', subgenus: '亚属', species: '种',
  subspecies: '亚种', variety: '变种', form: '变型', clade: '演化支', unranked: '未定级'
};

export const nextRank = {
  kingdom: 'phylum', phylum: 'class', class: 'order', order: 'family',
  suborder: 'family', family: 'genus', genus: 'species', species: 'subspecies'
};

// IUCN Red List categories, ordered from most to least threatened. Only species and subspecies carry one.
export const conservationStatuses = [
  ['EX', '灭绝'], ['EW', '野外灭绝'], ['CR', '极危'], ['EN', '濒危'], ['VU', '易危'],
  ['NT', '近危'], ['LC', '无危'], ['DD', '数据缺乏'], ['NE', '未评估']
];
const conservationNames = new Map(conservationStatuses);
export const conservationRanks = new Set(['species', 'subspecies']);

export function conservationLabel(code) { return conservationNames.get(code) || null; }

// Descriptive labels for species; unlike IUCN categories these are not a standardized scale.
export const toxicityLevels = [['none', '无毒'], ['mild', '微毒'], ['toxic', '有毒'], ['high', '剧毒']];
const toxicityNames = new Map(toxicityLevels);
export function toxicityLabel(level) { return toxicityNames.get(level) || null; }

export function rankLabel(rank) { return rankNames[rank] || rank; }

export function safeHttps(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
