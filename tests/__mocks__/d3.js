// Mock D3.js for testing
export const select = vi.fn(() => ({
  append: vi.fn().mockReturnThis(),
  attr: vi.fn().mockReturnThis(),
  style: vi.fn().mockReturnThis(),
  on: vi.fn().mockReturnThis(),
  call: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  selectAll: vi.fn().mockReturnThis(),
  data: vi.fn().mockReturnThis(),
  enter: vi.fn().mockReturnThis(),
  exit: vi.fn().mockReturnThis(),
  remove: vi.fn().mockReturnThis(),
  transition: vi.fn().mockReturnThis(),
  duration: vi.fn().mockReturnThis(),
  delay: vi.fn().mockReturnThis(),
  ease: vi.fn().mockReturnThis(),
  text: vi.fn().mockReturnThis(),
  html: vi.fn().mockReturnThis(),
  classed: vi.fn().mockReturnThis(),
  node: vi.fn().mockReturnThis(),
  nodes: vi.fn().mockReturnValue([]),
  datum: vi.fn().mockReturnThis(),
  property: vi.fn().mockReturnThis(),
  lower: vi.fn().mockReturnThis(),
  raise: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  sort: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  filter: vi.fn().mockReturnThis(),
  each: vi.fn().mockReturnThis(),
  merge: vi.fn().mockReturnThis(),
  selectChild: vi.fn().mockReturnThis(),
  selectChildren: vi.fn().mockReturnThis(),
  selectParent: vi.fn().mockReturnThis(),
  selectParents: vi.fn().mockReturnThis(),
  selectSibling: vi.fn().mockReturnThis(),
  selectSiblings: vi.fn().mockReturnThis(),
  size: vi.fn().mockReturnThis(),
  empty: vi.fn().mockReturnThis(),
  _groups: [[]],
  _parents: [document.body]
}));

export const event = {
  target: {},
  currentTarget: {},
  preventDefault: vi.fn(),
  stopPropagation: vi.fn()
};

export const scaleLinear = vi.fn(() => ({
  domain: vi.fn().mockReturnThis(),
  range: vi.fn().mockReturnThis(),
  nice: vi.fn().mockReturnThis(),
  copy: vi.fn().mockReturnThis()
}));

export const scaleOrdinal = vi.fn(() => ({
  domain: vi.fn().mockReturnThis(),
  range: vi.fn().mockReturnThis(),
  unknown: vi.fn().mockReturnThis()
}));

export const scaleBand = vi.fn(() => ({
  domain: vi.fn().mockReturnThis(),
  range: vi.fn().mockReturnThis(),
  padding: vi.fn().mockReturnThis(),
  paddingInner: vi.fn().mockReturnThis(),
  paddingOuter: vi.fn().mockReturnThis(),
  align: vi.fn().mockReturnThis(),
  round: vi.fn().mockReturnThis(),
  bandwidth: vi.fn().mockReturnValue(10),
  step: vi.fn().mockReturnValue(15)
}));

export const axisBottom = vi.fn(() => ({
  scale: vi.fn().mockReturnThis(),
  tickValues: vi.fn().mockReturnThis(),
  tickSize: vi.fn().mockReturnThis(),
  tickSizeInner: vi.fn().mockReturnThis(),
  tickSizeOuter: vi.fn().mockReturnThis(),
  tickPadding: vi.fn().mockReturnThis(),
  tickFormat: vi.fn().mockReturnThis(),
  ticks: vi.fn().mockReturnThis()
}));

export const axisLeft = vi.fn(() => ({
  scale: vi.fn().mockReturnThis(),
  tickValues: vi.fn().mockReturnThis(),
  tickSize: vi.fn().mockReturnThis(),
  tickSizeInner: vi.fn().mockReturnThis(),
  tickSizeOuter: vi.fn().mockReturnThis(),
  tickPadding: vi.fn().mockReturnThis(),
  tickFormat: vi.fn().mockReturnThis(),
  ticks: vi.fn().mockReturnThis()
}));

export const format = vi.fn().mockImplementation(d => d);

export const selectAll = select;

export default {
  select,
  selectAll,
  event,
  scaleLinear,
  scaleOrdinal,
  scaleBand,
  axisBottom,
  axisLeft,
  format
};
