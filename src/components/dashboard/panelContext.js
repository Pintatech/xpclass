import { createContext, useContext } from 'react'

// Carousel panels stay mounted while they sit off to the side, so anything that
// should play when a panel comes INTO view has to be told; it cannot rely on
// mounting. Outside a carousel the default reads as "on screen", which is what a
// panel that is not in one always is.
//
// Kept apart from HeroCarousel so that file exports only components and its fast
// refresh keeps working.
// `near` is the same idea one step wider: a panel within reach of the current
// one, which is as much warning as anything needs to have its art ready by the
// time it slides in. Panels further off can hold their heaviest pieces back.
export const PanelContext = createContext({ active: true, near: true })

export const useCarouselPanel = () => useContext(PanelContext)
