import { describe, it, expectTypeOf } from 'vitest'
import type { Carousel, SlotValue, CarouselStatus } from './carousel'

describe('Carousel types', () => {
  it('Carousel has required fields', () => {
    expectTypeOf<Carousel>().toHaveProperty('id')
    expectTypeOf<Carousel>().toHaveProperty('owner')
    expectTypeOf<Carousel>().toHaveProperty('slides')
    expectTypeOf<Carousel>().toHaveProperty('status')
  })

  it('SlotValue maps string to string', () => {
    const v: SlotValue = { s1_headline: 'hello' }
    expectTypeOf(v).toEqualTypeOf<Record<string, string>>()
  })

  it('CarouselStatus is a union', () => {
    expectTypeOf<CarouselStatus>().toEqualTypeOf<'draft' | 'exported'>()
  })
})
