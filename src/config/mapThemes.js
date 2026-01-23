// Map theme configurations - positions and curve control points for each theme
// Each theme has 11 positions (nodes) and 10 control points (curves between nodes)
// x, y values are percentages (0-100) of the container
// Desktop positions (desktopPositions/desktopControlPoints) are used on screens >= 768px (md breakpoint)

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
    ],
    // Desktop positions (adjust these x,y values for PC layout)
    desktopPositions: [
      { x: 20, y: 95 },  // 1
      { x: 41, y: 84 },  // 2
      { x: 52, y: 77 },  // 3
      { x: 36, y: 67 },  // 4
      { x: 22, y: 43 },  // 5
      { x: 50, y: 46 },  // 6
      { x: 51, y: 37 },  // 7
      { x: 23, y: 29 },  // 8
      { x: 41, y: 10 },  // 9
      { x: 77, y: 11 },  // 10
      { x: 90, y: 7 },  // 11
    ],
    desktopControlPoints: [
      { x: 34, y: 94 },   // curve 1 → 2
      { x: 52, y: 87 },   // curve 2 → 3
      { x: 47, y: 69 },   // curve 3 → 4
      { x: 22, y: 65 },   // curve 4 → 5
      { x: 35, y: 50 },   // curve 5 → 6
      { x: 85, y: 47 },   // curve 6 → 7
      { x: 37, y: 41 },   // curve 7 → 8
      { x: 24, y: 13 },   // curve 8 → 9
      { x: 59, y: 16 },   // curve 9 → 10
      { x: 81, y: 12 },   // curve 10 → 11
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
    ],
    desktopPositions: [
      { x: 10, y: 65 },  // 1
      { x: 21, y: 71 },  // 2
      { x: 31, y: 66 },  // 3
      { x: 43, y: 63 },  // 4
      { x: 55, y: 50 },  // 5
      { x: 64, y: 46 },  // 6
      { x: 76, y: 47 },  // 7
      { x: 83, y: 55 },  // 8
      { x: 71, y: 65 },  // 9
      { x: 77, y: 77 },  // 10
      { x: 90, y: 76 },  // 11
    ],
    desktopControlPoints: [
      { x: 14, y: 70 },   // curve 1 → 2
      { x: 27, y: 71 },   // curve 2 → 3
      { x: 37, y: 65 },   // curve 3 → 4
      { x: 50, y: 60 },   // curve 4 → 5
      { x: 60, y: 49 },   // curve 5 → 6
      { x: 70, y: 46 },   // curve 6 → 7
      { x: 82, y: 48 },   // curve 7 → 8
      { x: 74, y: 56 },   // curve 8 → 9
      { x: 70, y: 76 },   // curve 9 → 10
      { x: 82, y: 80 },   // curve 10 → 11
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
    ],
    desktopPositions: [
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
    desktopControlPoints: [
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
    ],
    desktopPositions: [
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
    desktopControlPoints: [
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
    ],
    desktopPositions: [
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
    desktopControlPoints: [
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
    ],
    desktopPositions: [
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
    desktopControlPoints: [
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
