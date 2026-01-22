// Map theme configurations - positions and curve control points for each theme
// Each theme has 11 positions (nodes) and 10 control points (curves between nodes)
// x, y values are percentages (0-100) of the container

const mapThemes = {
  //ice
  blue: {
    positions: [
      { x: 20, y: 95 },  // 1
      { x: 65, y: 90 },  // 2
      { x: 82, y: 78 },  // 3
      { x: 53, y: 68 },  // 4
      { x: 17, y: 60 },  // 5
      { x: 60, y: 50 },  // 6
      { x: 80, y: 38 },  // 7
      { x: 40, y: 32 },  // 8
      { x: 18, y: 22 },  // 9
      { x: 52, y: 14 },  // 10
      { x: 82, y: 6 },   // 11
    ],
    controlPoints: [
      { x: 45, y: 88 },   // curve 1 → 2
      { x: 85, y: 85 },   // curve 2 → 3
      { x: 73, y: 68 },   // curve 3 → 4
      { x: 15, y: 72 },   // curve 4 → 5
      { x: 28, y: 52 },   // curve 5 → 6
      { x: 85, y: 47 },   // curve 6 → 7
      { x: 65, y: 32 },   // curve 7 → 8
      { x: 20, y: 30 },   // curve 8 → 9
      { x: 28, y: 13 },   // curve 9 → 10
      { x: 75, y: 15 },   // curve 10 → 11
    ]
  },
  //forest
  green: {
    positions: [
      { x: 20, y: 95 },  // 1
      { x: 65, y: 90 },  // 2
      { x: 82, y: 78 },  // 3
      { x: 53, y: 68 },  // 4
      { x: 17, y: 62 },  // 5
      { x: 60, y: 50 },  // 6
      { x: 80, y: 38 },  // 7
      { x: 40, y: 33 },  // 8
      { x: 18, y: 22 },  // 9
      { x: 52, y: 14 },  // 10
      { x: 82, y: 6 },   // 11
    ],
    controlPoints: [
      { x: 45, y: 88 },   // curve 1 → 2
      { x: 85, y: 85 },   // curve 2 → 3
      { x: 73, y: 68 },   // curve 3 → 4
      { x: 15, y: 72 },   // curve 4 → 5
      { x: 28, y: 52 },   // curve 5 → 6
      { x: 85, y: 47 },   // curve 6 → 7
      { x: 65, y: 32 },   // curve 7 → 8
      { x: 20, y: 30 },   // curve 8 → 9
      { x: 28, y: 15 },   // curve 9 → 10
      { x: 75, y: 15 },   // curve 10 → 11
    ]
  },
  //pirate
  purple: {
    positions: [
      { x: 20, y: 95 },  // 1
      { x: 65, y: 90 },  // 2
      { x: 82, y: 78 },  // 3
      { x: 53, y: 68 },  // 4
      { x: 17, y: 62 },  // 5
      { x: 60, y: 50 },  // 6
      { x: 80, y: 38 },  // 7
      { x: 40, y: 33 },  // 8
      { x: 18, y: 22 },  // 9
      { x: 52, y: 14 },  // 10
      { x: 82, y: 6 },   // 11
    ],
    controlPoints: [
      { x: 45, y: 88 },   // curve 1 → 2
      { x: 85, y: 85 },   // curve 2 → 3
      { x: 73, y: 68 },   // curve 3 → 4
      { x: 15, y: 72 },   // curve 4 → 5
      { x: 28, y: 52 },   // curve 5 → 6
      { x: 85, y: 47 },   // curve 6 → 7
      { x: 65, y: 32 },   // curve 7 → 8
      { x: 20, y: 30 },   // curve 8 → 9
      { x: 28, y: 13 },   // curve 9 → 10
      { x: 75, y: 15 },   // curve 10 → 11
    ]
  },
  //Ninja
  orange: {
    positions: [
      { x: 20, y: 95 },  // 1
      { x: 65, y: 90 },  // 2
      { x: 81, y: 78 },  // 3
      { x: 53, y: 69 },  // 4
      { x: 17, y: 60 },  // 5
      { x: 55, y: 52 },  // 6
      { x: 80, y: 40 },  // 7
      { x: 40, y: 33 },  // 8
      { x: 18, y: 22 },  // 9
      { x: 52, y: 15 },  // 10
      { x: 82, y: 6 },   // 11
    ],
    controlPoints: [
      { x: 45, y: 88 },   // curve 1 → 2
      { x: 85, y: 85 },   // curve 2 → 3
      { x: 73, y: 68 },   // curve 3 → 4
      { x: 15, y: 72 },   // curve 4 → 5
      { x: 28, y: 53 },   // curve 5 → 6
      { x: 85, y: 47 },   // curve 6 → 7
      { x: 65, y: 32 },   // curve 7 → 8
      { x: 15, y: 32 },   // curve 8 → 9
      { x: 28, y: 15 },   // curve 9 → 10
      { x: 75, y: 15 },   // curve 10 → 11
    ]
  },
  //candy
  red: {
    positions: [
      { x: 20, y: 95 },  // 1
      { x: 65, y: 90 },  // 2
      { x: 82, y: 78 },  // 3
      { x: 53, y: 68 },  // 4
      { x: 17, y: 60 },  // 5
      { x: 60, y: 50 },  // 6
      { x: 80, y: 38 },  // 7
      { x: 40, y: 33 },  // 8
      { x: 18, y: 22 },  // 9
      { x: 52, y: 14 },  // 10
      { x: 82, y: 6 },   // 11
    ],
    controlPoints: [
      { x: 45, y: 88 },   // curve 1 → 2
      { x: 85, y: 85 },   // curve 2 → 3
      { x: 73, y: 68 },   // curve 3 → 4
      { x: 15, y: 72 },   // curve 4 → 5
      { x: 28, y: 52 },   // curve 5 → 6
      { x: 85, y: 47 },   // curve 6 → 7
      { x: 65, y: 32 },   // curve 7 → 8
      { x: 20, y: 30 },   // curve 8 → 9
      { x: 28, y: 15 },   // curve 9 → 10
      { x: 75, y: 15 },   // curve 10 → 11
    ]
  },

  //desert
  yellow: { 
    positions: [
      { x: 23, y: 95 },  // 1
      { x: 65, y: 91 },  // 2
      { x: 80, y: 78 },  // 3
      { x: 53, y: 70 },  // 4
      { x: 20, y: 60 },  // 5
      { x: 60, y: 52 },  // 6
      { x: 80, y: 38 },  // 7
      { x: 40, y: 33 },  // 8
      { x: 20, y: 23 },  // 9
      { x: 52, y: 14 },  // 10
      { x: 82, y: 6 },   // 11
    ],
    controlPoints: [
      { x: 38, y: 90 },   // curve 1 → 2
      { x: 85, y: 85 },   // curve 2 → 3
      { x: 73, y: 68 },   // curve 3 → 4
      { x: 15, y: 72 },   // curve 4 → 5
      { x: 28, y: 52 },   // curve 5 → 6
      { x: 85, y: 47 },   // curve 6 → 7
      { x: 65, y: 32 },   // curve 7 → 8
      { x: 20, y: 30 },   // curve 8 → 9
      { x: 29, y: 15 },   // curve 9 → 10
      { x: 75, y: 15 },   // curve 10 → 11
    ]
  },
}

// Helper to get theme config with fallback to blue
export const getMapTheme = (colorTheme) => {
  return mapThemes[colorTheme] || mapThemes.blue
}

// Default theme (blue)
export const defaultMapTheme = mapThemes.blue

export default mapThemes
