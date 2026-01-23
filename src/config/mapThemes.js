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
      { x: 9, y: 74 },  // 1
      { x: 18, y: 73 },  // 2
      { x: 34, y: 57 },  // 3
      { x: 42, y: 59 },  // 4
      { x: 58, y: 80 },  // 5
      { x: 68, y: 80 },  // 6
      { x: 89, y: 62 },  // 7
      { x: 83, y: 13 },  // 8
      { x: 59, y: 34 },  // 9
      { x: 38, y: 6 },  // 10
      { x: 13, y: 29 },  // 11
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
      { x: 6, y: 79 },  // 1
      { x: 20, y: 82 },  // 2
      { x: 38, y: 58 },  // 3
      { x: 63, y: 86 },  // 4
      { x: 83, y: 68 },  // 5
      { x: 94, y: 69 },  // 6
      { x: 90, y: 26 },  // 7
      { x: 83, y: 24 },  // 8
      { x: 51, y: 17 },  // 9
      { x: 22, y: 28 },  // 10
      { x: 10, y: 27 },  // 11
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
      { x: 7, y: 76 },  // 1
      { x: 16, y: 77 },  // 2
      { x: 31, y: 66 },  // 3
      { x: 43, y: 63 },  // 4
      { x: 65, y: 83 },  // 5
      { x: 89, y: 67 },  // 6
      { x: 86, y: 13 },  // 7
      { x: 61, y: 36 },  // 8
      { x: 37, y: 9 },  // 9
      { x: 15, y: 29 },  // 10
      { x: 8, y: 28 },  // 11
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
      { x: 10, y: 75 },  // 1
      { x: 33, y: 60 },  // 2
      { x: 42, y: 61 },  // 3
      { x: 63, y: 83 },  // 4
      { x: 88, y: 62 },  // 5
      { x: 86, y: 18 },  // 6
      { x: 61, y: 36 },  // 7
      { x: 38, y: 8 },  // 8
      { x: 31, y: 8 },  // 9
      { x: 14, y: 27 },  // 10
      { x: 5, y: 26 },  // 11
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
      { x: 6, y: 76 },  // 1
      { x: 18, y: 76 },  // 2
      { x: 31, y: 58 },  // 3
      { x: 42, y: 59 },  // 4
      { x: 66, y: 80 },  // 5
      { x: 88, y: 64 },  // 6
      { x: 86, y: 19 },  // 7
      { x: 62, y: 33 },  // 8
      { x: 38, y: 11 },  // 9
      { x: 19, y: 19 },  // 10
      { x: 6, y: 22 },  // 11
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
      { x: 7, y: 74 },  // 1
      { x: 16, y: 76 },  // 2
      { x: 35, y: 58 },  // 3
      { x: 42, y: 58 },  // 4
      { x: 56, y: 79 },  // 5
      { x: 68, y: 80 },  // 6
      { x: 87, y: 65 },  // 7
      { x: 83, y: 16 },  // 8
      { x: 60, y: 31 },  // 9
      { x: 37, y: 10 },  // 10
      { x: 9, y: 27 },  // 11
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
