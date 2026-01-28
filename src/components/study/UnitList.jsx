import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../supabase/client";
import { useAuth } from "../../hooks/useAuth";
import { usePermissions } from "../../hooks/usePermissions";
import Button from "../ui/Button";
import AddUnitModal from "./AddUnitModal";
import EditUnitModal from "./EditUnitModal";
// Thay spinner bằng skeleton để điều hướng mượt hơn
import {
  ArrowLeft,
  Star,
  Lock,
  BookOpen,
  Flame,
  Plus,
  Edit,
  List,
  Trash2,
} from "lucide-react";

// Theme-based background images for unit cards
const getThemeBackground = (colorTheme) => {
  const themeBackgrounds = {
    blue: "https://xpclass.vn/xpclass/image/theme_unit/ice.webp",
    green: "https://xpclass.vn/xpclass/image/theme_unit/forest.webp",
    purple: "https://xpclass.vn/xpclass/image/theme_unit/pirate.webp",
    orange: "https://xpclass.vn/xpclass/image/theme_unit/ninja.PNG",
    red: "https://xpclass.vn/xpclass/image/theme_unit/dino.webp",
    yellow: "https://xpclass.vn/xpclass/image/theme_unit/dessert.webp",
  };
  return themeBackgrounds[colorTheme] || themeBackgrounds.blue;
};

// Theme-based ribbon images for unit titles
const getRibbonImage = (colorTheme) => {
  const themeRibbons = {
    blue: "https://xpclass.vn/xpclass/image/unit_list/ice_label1.png",
    green: "https://xpclass.vn/xpclass/image/unit_list/forest_label.png",
    purple: "https://xpclass.vn/xpclass/image/unit_list/pirate_label.png",
    orange: "https://xpclass.vn/xpclass/image/unit_list/ninja_label1.png",
    red: "https://xpclass.vn/xpclass/image/unit_list/dino_label.webp",
    yellow: "https://xpclass.vn/xpclass/image/unit_list/desert_label.png",
  };
  return themeRibbons[colorTheme] || themeRibbons.blue;
};

// Theme-based border colors for unit cards
const getBorderColor = (colorTheme) => {
  const themeBorders = {
    blue: "border-[#a2d4f9]",
    green: "border-[#77cd0b]",
    purple: "border-blue-400",
    orange: "border-gray-700",
    red: "border-yellow-800",
    yellow: "border-yellow-400",
  };
  return themeBorders[colorTheme] || themeBorders.blue;
};

const UnitList = () => {
  const { levelId: rawLevelId, courseId: rawCourseId } = useParams();
  const sanitizeId = (v) => (v && v !== "undefined" && v !== "null" ? v : null);
  const levelId = sanitizeId(rawLevelId);
  const courseId = sanitizeId(rawCourseId);
  // Support both level and course routes for backward compatibility
  const currentId = courseId || levelId;
  const navigate = useNavigate();
  const [level, setLevel] = useState(null);
  const [units, setUnits] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [unitProgress, setUnitProgress] = useState({});
  const [sessionProgress, setSessionProgress] = useState({});
  const [userStats, setUserStats] = useState({ xp: 0, streak: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddUnitModal, setShowAddUnitModal] = useState(false);
  const [showEditUnitModal, setShowEditUnitModal] = useState(false);
  const [editingUnit, setEditingUnit] = useState(null);
  const { user, profile } = useAuth();
  const { canCreateContent } = usePermissions();

  // Skeletons
  const SkeletonCard = () => (
    <div className="relative overflow-hidden bg-white border rounded-lg p-6 animate-pulse">
      <div className="flex items-center space-x-3 mb-2">
        <div className="w-12 h-12 rounded-full bg-gray-200" />
        <div className="flex-1 min-w-0">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-1" />
          <div className="h-3 bg-gray-100 rounded w-1/4" />
        </div>
      </div>
      <div className="h-3 bg-gray-100 rounded w-2/3 mt-2" />
    </div>
  );

  useEffect(() => {
    if (user && currentId) {
      fetchLevelAndUnits();
    }
  }, [user, currentId]);

  const fetchLevelAndUnits = async () => {
    if (!currentId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);

      // Fetch level data
      const { data: levelData, error: levelError } = await supabase
        .from("courses")
        .select("*")
        .eq("id", currentId)
        .single();

      if (levelError) throw levelError;

      // For students, verify they are enrolled in this course
      if (profile?.role === "user") {
        const { data: enrollmentData, error: enrollmentError } = await supabase
          .from("course_enrollments")
          .select("id")
          .eq("student_id", user.id)
          .eq("course_id", currentId)
          .eq("is_active", true)
          .single();

        if (enrollmentError || !enrollmentData) {
          console.error(
            "Student not enrolled in this course:",
            enrollmentError
          );
          setError("Bạn chưa được ghi danh vào khóa học này");
          navigate("/study");
          return;
        }
      }

      // Fetch user stats (XP and streak)
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("xp, streak_count")
        .eq("id", user.id)
        .single();

      if (userError) {
        console.error("Error fetching user stats:", userError);
      } else {
        setUserStats({
          xp: userData?.xp || 0,
          streak: userData?.streak_count || 0,
        });
      }

      // Fetch units for this level
      const { data: unitsData, error: unitsError } = await supabase
        .from("units")
        .select("*")
        .eq("course_id", currentId)
        .eq("is_active", true)
        .order("unit_number");

      if (unitsError) throw unitsError;

      // Fetch sessions for these units to calculate progress
      const { data: sessionsData, error: sessionsError } = await supabase
        .from("sessions")
        .select("*")
        .in("unit_id", unitsData?.map((u) => u.id) || [])
        .eq("is_active", true)
        .order("session_number");

      if (sessionsError) throw sessionsError;

      // Get all session IDs for these units
      const sessionIds = sessionsData?.map((s) => s.id) || [];

      // Fetch user's progress for exercises in these sessions
      const { data: progressData, error: progressError } = await supabase
        .from("user_progress")
        .select(
          `
          *,
          exercises!inner(
            id,
            session_id,
            sessions!inner(
              id,
              unit_id
            )
          )
        `
        )
        .eq("user_id", user.id)
        .in("exercises.session_id", sessionIds);

      if (progressError) {
        console.error("Progress fetch error:", progressError);
        // If the complex query fails, try a simpler approach
        const { data: simpleProgressData, error: simpleError } = await supabase
          .from("user_progress")
          .select("*")
          .eq("user_id", user.id);

        if (simpleError) throw simpleError;

        // Calculate progress for each unit with simple data
        const progressMap = {};
        unitsData?.forEach((unit) => {
          const unitSessions =
            sessionsData?.filter((s) => s.unit_id === unit.id) || [];
          const totalSessions = unitSessions.length;

          progressMap[unit.id] = {
            unit_id: unit.id,
            total_sessions: totalSessions,
            sessions_completed: 0,
            progress_percentage: 0,
            status: "not_started",
            xp_earned: 0,
          };
        });
        setUnitProgress(progressMap);
        setSessions([]);
        setSessionProgress({});
        return;
      }

      // Calculate progress for each unit - PLACEHOLDER, will be updated after sessionProgressMap is ready
      const progressMap = {};
      unitsData?.forEach((unit) => {
        progressMap[unit.id] = {
          unit_id: unit.id,
          total_sessions: 0,
          sessions_completed: 0,
          progress_percentage: 0,
          status: "not_started",
          xp_earned: 0,
        };
      });

      // Calculate session progress
      const sessionProgressMap = {};

      // Fetch user's session progress (explicit session_progress rows)
      const { data: sessionProgressData, error: sessionProgressError } =
        await supabase
          .from("session_progress")
          .select("*")
          .eq("user_id", user.id)
          .in("session_id", sessionIds);

      if (sessionProgressError) {
        console.error("Error fetching session progress:", sessionProgressError);
      }

      // Fetch all assigned exercises for these sessions via linking table
      const { data: allAssignments, error: assignmentsErr } = await supabase
        .from("exercise_assignments")
        .select(
          `
          id,
          session_id,
          exercise:exercises(id, xp_reward, is_active)
        `
        )
        .in("session_id", sessionIds);

      if (assignmentsErr) {
        console.error("Error fetching exercise assignments:", assignmentsErr);
      }

      const exerciseIds = (allAssignments || [])
        .map((a) => a.exercise?.id)
        .filter(Boolean);

      // Fetch user's completed exercises among these
      const { data: userCompleted, error: userProgErr } = await supabase
        .from("user_progress")
        .select("exercise_id, status")
        .eq("user_id", user.id)
        .in("exercise_id", exerciseIds);

      if (userProgErr) {
        console.error("Error fetching user progress:", userProgErr);
      }

      // Build maps
      const sessionIdToExercises = {};
      (allAssignments || []).forEach((a) => {
        const ex = a.exercise;
        if (!ex) return;
        if (!sessionIdToExercises[a.session_id])
          sessionIdToExercises[a.session_id] = [];
        sessionIdToExercises[a.session_id].push({
          id: ex.id,
          session_id: a.session_id,
          xp_reward: ex.xp_reward,
          is_active: ex.is_active,
        });
      });

      const completedSet = new Set(
        (userCompleted || [])
          .filter((p) => p.status === "completed")
          .map((p) => p.exercise_id)
      );

      // Seed with DB rows first
      sessionProgressData?.forEach((progress) => {
        sessionProgressMap[progress.session_id] = progress;
      });

      // Fill/override computed fields
      sessionsData?.forEach((s) => {
        const list = sessionIdToExercises[s.id] || [];
        const total = list.length;
        const completedCount = list.filter((ex) =>
          completedSet.has(ex.id)
        ).length;
        const xpEarned = list
          .filter((ex) => completedSet.has(ex.id))
          .reduce((sum, ex) => sum + (ex.xp_reward || 0), 0);
        const percentage =
          total > 0 ? Math.round((completedCount / total) * 100) : 0;

        const existing = sessionProgressMap[s.id];
        if (existing) {
          sessionProgressMap[s.id] = {
            ...existing,
            xp_earned: Math.max(existing.xp_earned || 0, xpEarned),
            progress_percentage: Math.max(
              existing.progress_percentage || 0,
              percentage
            ),
          };
        } else {
          sessionProgressMap[s.id] = {
            user_id: user.id,
            session_id: s.id,
            status:
              total > 0 && completedCount === total
                ? "completed"
                : "in_progress",
            xp_earned: xpEarned,
            progress_percentage: percentage,
          };
        }
      });

      // NOW calculate unit progress based on sessionProgressMap
      unitsData?.forEach((unit) => {
        const unitSessions =
          sessionsData?.filter((s) => s.unit_id === unit.id) || [];
        const totalSessions = unitSessions.length;

        // Count sessions where ALL exercises are completed
        const completedSessions = unitSessions.filter((session) => {
          const sessionProg = sessionProgressMap[session.id];
          return sessionProg?.status === "completed";
        });
        const sessionsCompleted = completedSessions.length;
        const progressPercentage =
          totalSessions > 0
            ? Math.round((sessionsCompleted / totalSessions) * 100)
            : 0;

        progressMap[unit.id] = {
          unit_id: unit.id,
          total_sessions: totalSessions,
          sessions_completed: sessionsCompleted,
          progress_percentage: progressPercentage,
          status:
            sessionsCompleted === totalSessions && totalSessions > 0
              ? "completed"
              : sessionsCompleted > 0
                ? "in_progress"
                : "not_started",
          xp_earned: completedSessions.reduce(
            (sum, s) => sum + (sessionProgressMap[s.id]?.xp_earned || 0),
            0
          ),
        };
      });

      setLevel(levelData);
      setUnits(unitsData || []);
      setSessions(sessionsData || []);
      setUnitProgress(progressMap);
      setSessionProgress(sessionProgressMap);

    } catch (err) {
      console.error("Error fetching units:", err);
      setError("Không thể tải danh sách unit");
    } finally {
      setLoading(false);
    }
  };

  const handleUnitCreated = (newUnit) => {
    setUnits((prev) => [...prev, newUnit]);
    setShowAddUnitModal(false);
    // Show success message
    alert("Unit created successfully!");
  };

  const handleUnitUpdated = (updatedUnit) => {
    setUnits((prev) =>
      prev.map((unit) => (unit.id === updatedUnit.id ? updatedUnit : unit))
    );
    setShowEditUnitModal(false);
    setEditingUnit(null);
    // Show success message
    alert("Unit updated successfully!");
  };

  const handleEditUnit = (unit) => {
    setEditingUnit(unit);
    setShowEditUnitModal(true);
  };

  const handleDeleteUnit = async (unit) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete the unit "${unit.title}"?\n\nThis will also delete all sessions and exercises in this unit. This action cannot be undone.`
    );

    if (!confirmDelete) return;

    try {
      const { error } = await supabase.from("units").delete().eq("id", unit.id);

      if (error) throw error;

      // Remove from local state
      setUnits((prev) => prev.filter((u) => u.id !== unit.id));
      // Remove sessions for this unit
      setSessions((prev) => prev.filter((s) => s.unit_id !== unit.id));

      alert("Unit deleted successfully!");
    } catch (err) {
      console.error("Error deleting unit:", err);
      alert("Failed to delete unit: " + (err.message || "Unknown error"));
    }
  };

  const getSessionStatus = (session, index) => {
    const progress = sessionProgress[session.id];

    // All sessions are now always available (unlocked)
    if (!progress) {
      return { status: "available", canAccess: true };
    }

    return {
      status: progress.status,
      canAccess: true, // Always allow access
    };
  };

  const handleSessionClick = async (session) => {
    // Always go to exercise list regardless of exercise count
    const base = levelId
      ? `/study/level/${levelId}`
      : `/study/course/${currentId}`;
    navigate(`${base}/unit/${session.unit_id}/session/${session.id}`);
  };

  const renderSessionCard = (session, index, colorTheme) => {
    const { status, canAccess } = getSessionStatus(session, index);
    const progress = sessionProgress[session.id];
    const isLocked = !canAccess;
    const progressPercentage = progress?.progress_percentage || 0;

    // Theme-based colors for completed status
    const themeBackColors = {
      blue: "bg-cyan-700",
      green: "bg-green-700",
      purple: "bg-blue-700",
      orange: "bg-gray-900",
      red: "bg-yellow-700",
      yellow: "bg-yellow-700",
    };

    const themeFrontColors = {
      blue: "bg-[#4bece5]",
      green: "bg-green-500",
      purple: "bg-blue-500",
      orange: "bg-gray-700",
      red: "bg-brown-500",
      yellow: "bg-yellow-500",
    };

    // Get colors based on status
    const getBackColor = () => {
      if (status === "completed") return themeBackColors[colorTheme] || "bg-green-700";
      return "bg-gray-400";
    };

    const getFrontColor = () => {
      if (status === "completed") return themeFrontColors[colorTheme] || "bg-green-500";
      return "bg-gray-300";
    };

    return (
      <div
        key={session.id}
        onClick={() => !isLocked && handleSessionClick(session)}
        className={`block ${isLocked ? "cursor-not-allowed" : "cursor-pointer"
          } w-full`}
      >
        <div
          className="relative w-full"
          style={{ aspectRatio: "4/3" }}
        >
          {/* Back shadow layer */}
          <span
            className={`absolute inset-0 rounded-lg ${getBackColor()}`}
          />
          {/* Front button layer */}
          <span
            className={`absolute inset-0 rounded-lg flex items-center justify-center transition-all duration-150 ${getFrontColor()} ${!isLocked ? "active:translate-y-0 active:shadow-none" : ""
              }`}
            style={{
              transform: 'translateY(-10%)',
              boxShadow: '0 0.5em 1em -0.2em rgba(0, 0, 0, 0.3)'
            }}
            onMouseEnter={(e) => {
              if (!isLocked) {
                e.currentTarget.style.transform = 'translateY(-15%)'
              }
            }}
            onMouseLeave={(e) => {
              if (!isLocked) {
                e.currentTarget.style.transform = 'translateY(-10%)'
              }
            }}
            onMouseDown={(e) => {
              if (!isLocked) {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'none'
              }
            }}
            onMouseUp={(e) => {
              if (!isLocked) {
                e.currentTarget.style.transform = 'translateY(-15%)'
                e.currentTarget.style.boxShadow = '0 0.5em 1em -0.2em rgba(0, 0, 0, 0.3)'
              }
            }}
            onTouchStart={(e) => {
              if (!isLocked) {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'none'
              }
            }}
            onTouchEnd={(e) => {
              if (!isLocked) {
                e.currentTarget.style.transform = 'translateY(-10%)'
                e.currentTarget.style.boxShadow = '0 0.5em 1em -0.2em rgba(0, 0, 0, 0.3)'
              }
            }}
          >
            {/* Lock icon */}
            {isLocked && (
              <div className="absolute top-2 right-2 z-40">
                <Lock className="w-4 h-4 text-gray-600" />
              </div>
            )}

            {/* Session Title */}
            <div className="absolute inset-0 flex items-center justify-center px-2">
              <h3 className={`font-bold text-[11px] text-center leading-tight line-clamp-2 ${status === "completed" || progressPercentage > 0 ? "text-white" : "text-gray-700"
                }`}>
                {session.title}
              </h3>
            </div>
          </span>
        </div>
      </div>
    );
  };

  if (loading && units.length === 0) {
    return (
      <div className="flex bg-white">
        {/* Main content skeleton */}
        <div className="flex-1 flex flex-col overflow-hidden p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, idx) => (
              <SkeletonCard key={idx} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 mb-4">{error}</div>
        <Button onClick={fetchLevelAndUnits} variant="outline">
          Thử lại
        </Button>
      </div>
    );
  }

  if (!level) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-600 mb-4">Không tìm thấy level</div>
        <Button onClick={() => navigate("/study")} variant="outline">
          Quay lại
        </Button>
      </div>
    );
  }

  return (
    <div className="flex bg-white -mx-4 -my-6">
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden w-full">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/study")}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Quay lại
              </Button>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          <>
            {/* Units with Sessions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-10 mt-4">
              {units.map((unit) => {
                const unitSessions = sessions
                  .filter((session) => session.unit_id === unit.id)
                  .sort(
                    (a, b) =>
                      (a.session_number || 0) - (b.session_number || 0)
                  );

                const progress = unitProgress[unit.id];

                const backgroundImage = unit.thumbnail_url || getThemeBackground(unit.color_theme);

                return (
                  <div
                    key={unit.id}
                    className={`relative rounded-lg border-4 ${getBorderColor(unit.color_theme)} p-4 overflow-visible`}
                    style={{
                      backgroundImage: `url(${backgroundImage})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  >
                    {/* Overlay for readability */}
                    <div className="absolute inset-0 bg-white/30" />

                    {/* Ribbon centered at top, overlapping the div */}
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 z-20">
                      <div className="relative">
                        <img
                          src={getRibbonImage(unit.color_theme)}
                          className="w-48 h-12"
                          alt=""
                        />

                        {/* Text overlay */}
                        <span className="absolute inset-0 flex items-center justify-center text-white font-bold text-lg drop-shadow-md">
                          {unit.title}
                        </span>
                      </div>
                    </div>

                    {/* Unit Header */}
                    <div className="relative mb-3 mt-6 flex items-center justify-end">
                      <div className="flex items-center space-x-3">
                        {canCreateContent() && (
                          <button
                            onClick={() => {
                              const base = levelId
                                ? `/study/level/${levelId}`
                                : `/study/course/${currentId}`;
                              navigate(`${base}/unit/${unit.id}`);
                            }}
                            className="p-2 text-blue-400 hover:text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                            title="Manage sessions"
                          >
                            <List className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        {canCreateContent() && (
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={() => handleEditUnit(unit)}
                              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                              title="Edit unit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteUnit(unit)}
                              className="p-2 text-red-400 hover:text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                              title="Delete unit"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Sessions Grid for this Unit */}
                    {unitSessions.length > 0 ? (
                      <div
                        className="relative grid grid-cols-3 md:grid-cols-6 lg:grid-cols-4 xl:grid-cols-3 gap-3"
                        style={{ gridAutoFlow: "dense" }}
                      >
                        {unitSessions.map((session, index) => (
                          <div
                            key={session.id}
                            className="flex justify-center items-start"
                          >
                            <div style={{ width: "80px", height: "80px" }}>
                              {renderSessionCard(session, index, unit.color_theme)}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="relative text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                        {canCreateContent() ? (
                          <Button
                            onClick={() => {
                              const base = levelId
                                ? `/study/level/${levelId}`
                                : `/study/course/${currentId}`;
                              navigate(`${base}/unit/${unit.id}`);
                            }}
                            className="bg-green-600 text-white hover:bg-green-700"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Add Sessions
                          </Button>
                        ) : (
                          <p className="text-sm text-gray-500">
                            Sessions will be available soon
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {/* Add Unit Button */}
              {canCreateContent() && (
                <div className="bg-white rounded-lg border-2 border-dashed border-gray-300 p-8 text-center hover:border-blue-400 transition-colors">
                  <div className="flex flex-col items-center space-y-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Plus className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-gray-600">
                        Create a new learning unit for this level
                      </p>
                    </div>
                    <Button
                      onClick={() => setShowAddUnitModal(true)}
                      className="bg-blue-600 text-white hover:bg-blue-700"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Create Unit
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Empty state */}
            {units.length === 0 && (
              <div className="text-center py-12">
                <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Chưa có unit nào
                </h3>
                <p className="text-gray-600">
                  Các unit học tập sẽ sớm được cập nhật!
                </p>
                {canCreateContent() && (
                  <Button
                    onClick={() => setShowAddUnitModal(true)}
                    className="mt-4 bg-blue-600 text-white hover:bg-blue-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create First Unit
                  </Button>
                )}
              </div>
            )}
          </>
        </div>
      </div>

      {/* Add Unit Modal */}
      {showAddUnitModal && (
        <AddUnitModal
          levelId={currentId}
          onClose={() => setShowAddUnitModal(false)}
          onCreated={handleUnitCreated}
        />
      )}

      {/* Edit Unit Modal */}
      {showEditUnitModal && editingUnit && (
        <EditUnitModal
          unit={editingUnit}
          onClose={() => {
            setShowEditUnitModal(false);
            setEditingUnit(null);
          }}
          onUpdated={handleUnitUpdated}
        />
      )}

    </div>
  );
};

export default UnitList;
