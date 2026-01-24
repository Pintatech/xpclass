// Map theme configurations - positions and curve control points for each theme
// Each theme has 11 positions (nodes) and 10 control points (curves between nodes)
// x, y values are percentages (0-100) of the container
// Desktop positions (desktopPositions/desktopControlPoints) are used on screens >= 768px (md breakpoint)

const mapThemes = {
  //ice
  blue: {
    positions: [
      { x: 41, y: 97 },  // 1
      { x: 50, y: 86 },  // 2
      { x: 42, y: 73 },  // 3
      { x: 28, y: 63 },  // 4
      { x: 25, y: 51 },  // 5
      { x: 49, y: 44 },  // 6
      { x: 67, y: 38 },  // 7
      { x: 74, y: 32 },  // 8
      { x: 62, y: 21 },  // 9
      { x: 48, y: 16 },  // 10
      { x: 27, y: 9 },  // 11
    ],
    controlPoints: [
      { x: 52, y: 90 },   // curve 1 → 2
      { x: 52, y: 78 },   // curve 2 → 3
      { x: 33, y: 67 },   // curve 3 → 4
      { x: 19, y: 58 },   // curve 4 → 5
      { x: 35, y: 47 },   // curve 5 → 6
      { x: 58, y: 42 },   // curve 6 → 7
      { x: 72, y: 37 },   // curve 7 → 8
      { x: 74, y: 27 },   // curve 8 → 9
      { x: 58, y: 19 },   // curve 9 → 10
      { x: 39, y: 12 },   // curve 10 → 11
    ],
    // Desktop positions (adjust these x,y values for PC layout)
    desktopPositions: [
      { x: 4, y: 53 },  // 1
      { x: 16, y: 54 },  // 2
      { x: 31, y: 56 },  // 3
      { x: 57, y: 68 },  // 4
      { x: 79, y: 65 },  // 5
      { x: 67, y: 54 },  // 6
      { x: 85, y: 40 },  // 7
      { x: 70, y: 35 },  // 8
      { x: 48, y: 31 },  // 9
      { x: 61, y: 21 },  // 10
      { x: 45, y: 9 },  // 11
    ],
    desktopControlPoints: [
      { x: 14, y: 70 },   // curve 1 → 2
      { x: 27, y: 67 },   // curve 2 → 3
      { x: 38, y: 59 },   // curve 3 → 4
      { x: 50, y: 67 },   // curve 4 → 5
      { x: 64, y: 85 },   // curve 5 → 6
      { x: 78, y: 75 },   // curve 6 → 7
      { x: 82, y: 50 },   // curve 7 → 8
      { x: 71, y: 27 },   // curve 8 → 9
      { x: 46, y: 14 },   // curve 9 → 10
      { x: 20, y: 25 },   // curve 10 → 11
    ]
  },
  //forest
  green: {
    positions: [
      { x: 40, y: 96 },  // 1
      { x: 50, y: 87 },  // 2
      { x: 43, y: 74 },  // 3
      { x: 31, y: 64 },  // 4
      { x: 24, y: 53 },  // 5
      { x: 40, y: 45 },  // 6
      { x: 64, y: 38 },  // 7
      { x: 68, y: 28 },  // 8
      { x: 56, y: 19 },  // 9
      { x: 41, y: 13 },  // 10
      { x: 21, y: 4 },  // 11
    ],
    controlPoints: [
      { x: 47, y: 94 },   // curve 1 → 2
      { x: 52, y: 79 },   // curve 2 → 3
      { x: 36, y: 69 },   // curve 3 → 4
      { x: 24, y: 58 },   // curve 4 → 5
      { x: 25, y: 49 },   // curve 5 → 6
      { x: 49, y: 42 },   // curve 6 → 7
      { x: 69, y: 34 },   // curve 7 → 8
      { x: 66, y: 21 },   // curve 8 → 9
      { x: 49, y: 17 },   // curve 9 → 10
      { x: 30, y: 7 },   // curve 10 → 11
    ],
    desktopPositions: [
      { x: 2, y: 46 },  // 1
      { x: 15, y: 45 },  // 2
      { x: 25, y: 49 },  // 3
      { x: 45, y: 62 },  // 4
      { x: 59, y: 50 },  // 5
      { x: 73, y: 45 },  // 6
      { x: 90, y: 26 },  // 7
      { x: 60, y: 70 },  // 8
      { x: 81, y: 74 },  // 9
      { x: 97, y: 68 },  // 10
      { x: 44, y: 11 },  // 11
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
      { x: 56, y: 95 },  // 1
      { x: 57, y: 80 },  // 2
      { x: 44, y: 74 },  // 3
      { x: 30, y: 66 },  // 4
      { x: 28, y: 52 },  // 5
      { x: 44, y: 45 },  // 6
      { x: 70, y: 38 },  // 7
      { x: 70, y: 28 },  // 8
      { x: 57, y: 19 },  // 9
      { x: 35, y: 11 },  // 10
      { x: 22, y: 3 },  // 11
    ],
    controlPoints: [
      { x: 69, y: 88 },   // curve 1 → 2
      { x: 50, y: 78 },   // curve 2 → 3
      { x: 35, y: 70 },   // curve 3 → 4
      { x: 19, y: 60 },   // curve 4 → 5
      { x: 31, y: 48 },   // curve 5 → 6
      { x: 53, y: 43 },   // curve 6 → 7
      { x: 73, y: 33 },   // curve 7 → 8
      { x: 70, y: 23 },   // curve 8 → 9
      { x: 46, y: 14 },   // curve 9 → 10
      { x: 28, y: 8 },   // curve 10 → 11
    ],
    desktopPositions: [
      { x: 4, y: 30 },  // 1
      { x: 15, y: 37 },  // 2
      { x: 5, y: 47 },  // 3
      { x: 19, y: 53 },  // 4
      { x: 29, y: 64 },  // 5
      { x: 51, y: 80 },  // 6
      { x: 58, y: 54 },  // 7
      { x: 67, y: 79 },  // 8
      { x: 81, y: 75 },  // 9
      { x: 95, y: 74 },  // 10
      { x: 78, y: 45 },  // 11
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
  //Ninja
  orange: {
    positions: [
      { x: 44, y: 95 },  // 1
      { x: 50, y: 85 },  // 2
      { x: 44, y: 75 },  // 3
      { x: 32, y: 66 },  // 4
      { x: 25, y: 56 },  // 5
      { x: 36, y: 47 },  // 6
      { x: 52, y: 42 },  // 7
      { x: 69, y: 37 },  // 8
      { x: 74, y: 30 },  // 9
      { x: 57, y: 22 },  // 10
      { x: 62, y: 16 },  // 11
    ],
    controlPoints: [
      { x: 49, y: 91 },   // curve 1 → 2
      { x: 47, y: 79 },   // curve 2 → 3
      { x: 40, y: 72 },   // curve 3 → 4
      { x: 25, y: 59 },   // curve 4 → 5
      { x: 24, y: 52 },   // curve 5 → 6
      { x: 42, y: 44 },   // curve 6 → 7
      { x: 61, y: 40 },   // curve 7 → 8
      { x: 75, y: 34 },   // curve 8 → 9
      { x: 70, y: 26 },   // curve 9 → 10
      { x: 48, y: 20 },   // curve 10 → 11
    ],
    desktopPositions: [
      { x: 36, y: 90 },  // 1
      { x: 27, y: 71 },  // 2
      { x: 43, y: 70 },  // 3
      { x: 82, y: 82 },  // 4
      { x: 92, y: 77 },  // 5
      { x: 64, y: 54 },  // 6
      { x: 75, y: 46 },  // 7
      { x: 62, y: 36 },  // 8
      { x: 38, y: 28 },  // 9
      { x: 49, y: 15 },  // 10
      { x: 32, y: 8 },  // 11
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
  //candy
  red: {
    positions: [
      { x: 46, y: 96 },  // 1
      { x: 51, y: 87 },  // 2
      { x: 46, y: 76 },  // 3
      { x: 35, y: 69 },  // 4
      { x: 24, y: 59 },  // 5
      { x: 31, y: 49 },  // 6
      { x: 66, y: 37 },  // 7
      { x: 70, y: 27 },  // 8
      { x: 59, y: 19 },  // 9
      { x: 38, y: 11 },  // 10
      { x: 23, y: 4 },  // 11
    ],
    controlPoints: [
      { x: 52, y: 93 },   // curve 1 → 2
      { x: 49, y: 81 },   // curve 2 → 3
      { x: 40, y: 73 },   // curve 3 → 4
      { x: 25, y: 64 },   // curve 4 → 5
      { x: 24, y: 53 },   // curve 5 → 6
      { x: 50, y: 42 },   // curve 6 → 7
      { x: 74, y: 33 },   // curve 7 → 8
      { x: 67, y: 24 },   // curve 8 → 9
      { x: 52, y: 15 },   // curve 9 → 10
      { x: 27, y: 9 },   // curve 10 → 11
    ],
    desktopPositions: [
      { x: 32, y: 90 },  // 1
      { x: 23, y: 67 },  // 2
      { x: 41, y: 56 },  // 3
      { x: 86, y: 89 },  // 4
      { x: 61, y: 84 },  // 5
      { x: 11, y: 34 },  // 6
      { x: 35, y: 34 },  // 7
      { x: 77, y: 45 },  // 8
      { x: 85, y: 31 },  // 9
      { x: 68, y: 20 },  // 10
      { x: 50, y: 13 },  // 11
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

  //desert
  yellow: {
    positions: [
      { x: 48, y: 97 },  // 1
      { x: 49, y: 84 },  // 2
      { x: 42, y: 74 },  // 3
      { x: 31, y: 65 },  // 4
      { x: 24, y: 56 },  // 5
      { x: 33, y: 48 },  // 6
      { x: 62, y: 39 },  // 7
      { x: 69, y: 28 },  // 8
      { x: 53, y: 24 },  // 9
      { x: 38, y: 18 },  // 10
      { x: 45, y: 13 },  // 11
    ],
    controlPoints: [
      { x: 55, y: 91 },   // curve 1 → 2
      { x: 44, y: 78 },   // curve 2 → 3
      { x: 35, y: 70 },   // curve 3 → 4
      { x: 25, y: 61 },   // curve 4 → 5
      { x: 23, y: 52 },   // curve 5 → 6
      { x: 49, y: 43 },   // curve 6 → 7
      { x: 76, y: 36 },   // curve 7 → 8
      { x: 65, y: 25 },   // curve 8 → 9
      { x: 39, y: 21 },   // curve 9 → 10
      { x: 67, y: 16 },   // curve 10 → 11
    ],
    desktopPositions: [
      { x: 42, y: 90 },  // 1
      { x: 29, y: 82 },  // 2
      { x: 11, y: 69 },  // 3
      { x: 26, y: 61 },  // 4
      { x: 43, y: 56 },  // 5
      { x: 75, y: 56 },  // 6
      { x: 85, y: 47 },  // 7
      { x: 70, y: 45 },  // 8
      { x: 54, y: 42 },  // 9
      { x: 62, y: 32 },  // 10
      { x: 47, y: 26 },  // 11
    ],
    desktopControlPoints: [
      { x: 12, y: 55 },   // curve 1 → 2
      { x: 21, y: 57 },   // curve 2 → 3
      { x: 28, y: 57 },   // curve 3 → 4
      { x: 36, y: 50 },   // curve 4 → 5
      { x: 44, y: 57 },   // curve 5 → 6
      { x: 50, y: 54 },   // curve 6 → 7
      { x: 56, y: 59 },   // curve 7 → 8
      { x: 67, y: 61 },   // curve 8 → 9
      { x: 75, y: 52 },   // curve 9 → 10
      { x: 83, y: 58 },   // curve 10 → 11
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
