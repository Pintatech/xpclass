# Individual Exercise Assignments - Complete Guide

This guide explains how to use the Individual Assignment feature to assign exercises to specific students.

## Overview

The Individual Assignment system allows teachers and admins to assign exercises directly to specific students, separate from the regular class/session structure.

### Key Benefits:

- ✅ **Personalized Learning**: Assign remedial work or advanced exercises to individual students
- ✅ **Flexible Due Dates**: Set specific deadlines for each assignment
- ✅ **Priority Levels**: Mark urgent assignments as high priority
- ✅ **Teacher Notes**: Add personalized instructions or feedback
- ✅ **Progress Tracking**: Monitor completion status and scores
- ✅ **Separate from Class Work**: Individual assignments don't interfere with regular sessions

## For Teachers/Admins

### Step 1: Run Database Migration

First, run the SQL migration to create the necessary table:

1. Go to your Supabase Dashboard → SQL Editor
2. Open the file: `src/supabase/add_individual_assignments.sql`
3. Execute the SQL script
4. Verify the table was created: `individual_exercise_assignments`

### Step 2: Assign an Exercise to a Student

#### Method 1: From Exercise Bank

1. Go to **Admin Panel** → **Exercise Bank**
2. Find the exercise you want to assign
3. Click the **⋮** (three dots) menu
4. Click **"Assign to Student"** (blue text with user icon)
5. Fill in the assignment form:
   - **Select Student**: Choose from dropdown
   - **Due Date** (optional): Set a deadline
   - **Priority**: Low, Medium, or High
   - **Notes** (optional): Add instructions for the student
6. Click **"Assign Exercise"**

#### Form Fields Explained:

```
┌─────────────────────────────────────┐
│ Assign to Student                   │
├─────────────────────────────────────┤
│                                     │
│ Exercise: Present Tense Quiz        │
│ Type: multiple_choice • Diff: 2     │
│                                     │
│ Student: [Select dropdown]  *       │
│                                     │
│ Due Date: [Date picker]             │
│                                     │
│ Priority: ○ Low ● Medium ○ High     │
│                                     │
│ Notes for Student:                  │
│ ┌─────────────────────────────────┐ │
│ │ Focus on present continuous...  │ │
│ └─────────────────────────────────┘ │
│                                     │
│ [Cancel]  [Assign Exercise]         │
└─────────────────────────────────────┘
```

### Step 3: Monitor Student Progress

#### Check Individual Assignment Status:

Currently, teachers can see if exercises are assigned, but a dedicated teacher management view is coming soon.

**Temporary workaround**: Check the database directly:
```sql
SELECT * FROM individual_assignments_with_details
WHERE assigned_by = 'your-user-id'
ORDER BY created_at DESC;
```

## For Students

### Viewing Your Personal Assignments

Students can access their individual assignments in two ways:

#### Method 1: Dashboard Widget

On the main dashboard, look for the **"Personal Assignments"** widget:

```
┌────────────────────────────────────┐
│ 👤 Personal Assignments            │
│    From your teacher           →   │
├────────────────────────────────────┤
│  ⚠ 1    ⏱ 2    ⏳ 1    ✓ 5        │
│ Overdue  New  Progress  Done       │
│                                    │
│ 3 assignments to complete          │
└────────────────────────────────────┘
```

Click anywhere on this widget to go to your assignments page.

#### Method 2: Direct URL

Navigate to: `/study/my-assignments`

### Assignment Page Features

```
My Personal Assignments
Exercises assigned specifically to you by your teacher

┌──────────────────────────┐
│  🔵 2    🟡 1    🟢 5   │
│  New   Progress  Done   │
└──────────────────────────┘

[All (8)] [New (2)] [In Progress (1)] [Completed (5)]

┌────────────────────────────────────────────────┐
│ 📘 Present Tense Quiz                          │
│ Multiple Choice • assigned • 🔴 high           │
│                                                │
│ 📅 Due tomorrow ⚠️                             │
│                                                │
│ 📝 Teacher's note: Focus on present continuous│
│                                                │
│                                [▶ Start]       │
└────────────────────────────────────────────────┘
```

### Assignment Card Details:

- **Exercise Icon**: Shows exercise type
- **Title**: Exercise name
- **Status Badge**: assigned | in_progress | completed
- **Priority Flag**: Shows if high priority
- **Due Date**:
  - Red "Overdue" if past due
  - Orange "Due today" or "Due tomorrow"
  - Yellow "Due in X days"
  - Gray date if >3 days away
- **Teacher's Note**: Special instructions
- **Action Button**:
  - "Start" for new assignments
  - "Continue" for in-progress
  - "Review" for completed

### Starting an Assignment

1. Click **[▶ Start]** button
2. You'll be taken to the exercise
3. The URL will include `?exerciseId=...&assignmentId=...`
4. Complete the exercise as normal
5. Your progress is automatically tracked

## Use Cases

### 1. Remedial Work

**Scenario**: Student struggles with past tense

```javascript
Teacher assigns:
- Exercise: "Past Tense Practice"
- Priority: High
- Due: Tomorrow
- Note: "Please review irregular verbs before starting"
```

### 2. Advanced Practice

**Scenario**: Student excels and needs more challenge

```javascript
Teacher assigns:
- Exercise: "Advanced Grammar Quiz"
- Priority: Medium
- Due: Next week
- Note: "Optional bonus work for extra credit"
```

### 3. Make-up Work

**Scenario**: Student missed a class

```javascript
Teacher assigns:
- Exercise: "Unit 3 Vocabulary"
- Priority: High
- Due: Friday
- Note: "Complete this to catch up with the class"
```

### 4. Homework

**Scenario**: Regular homework assignment

```javascript
Teacher assigns:
- Exercise: "Listening Comprehension #5"
- Priority: Medium
- Due: Next Monday
- Note: "Listen to each audio clip twice maximum"
```

## Database Schema

### Table: `individual_exercise_assignments`

```sql
CREATE TABLE individual_exercise_assignments (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,              -- Student
  exercise_id UUID NOT NULL,          -- Exercise
  assigned_by UUID,                   -- Teacher/Admin
  assigned_at TIMESTAMP DEFAULT NOW(),
  due_date TIMESTAMP,                 -- Optional deadline
  status TEXT DEFAULT 'assigned',     -- assigned | in_progress | completed
  completed_at TIMESTAMP,
  score INTEGER,                      -- 0-100
  notes TEXT,                         -- Teacher's note
  priority TEXT DEFAULT 'medium',     -- low | medium | high
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, exercise_id)        -- One assignment per student-exercise pair
);
```

### View: `individual_assignments_with_details`

Joins with exercises and profiles tables to provide:
- Exercise title, type, difficulty, XP, duration
- Student name and email
- Assigning teacher name and email

## API / Hook Usage

### For Students (useIndividualAssignments hook):

```javascript
import { useIndividualAssignments } from '../hooks/useIndividualAssignments'

// Get my assignments
const { assignments, loading, error, fetchMyAssignments } = useIndividualAssignments()

// Update assignment status when student starts
await updateAssignmentStatus(assignmentId, 'in_progress')

// Update when completed
await updateAssignmentStatus(assignmentId, 'completed', score)

// Get stats
const stats = await getAssignmentStats()
// Returns: { total, assigned, inProgress, completed }
```

### For Teachers (creating assignments):

```javascript
import { useIndividualAssignments } from '../hooks/useIndividualAssignments'

const { createAssignment } = useIndividualAssignments()

const result = await createAssignment({
  userId: studentId,
  exerciseId: exerciseId,
  dueDate: '2025-01-15T23:59:59',
  priority: 'high',
  notes: 'Focus on pronunciation'
})

if (result.success) {
  console.log('Assignment created!')
} else {
  console.error(result.error)
}
```

## Row Level Security (RLS) Policies

The system has built-in security:

1. **Students can only view their own assignments**
   ```sql
   WHERE auth.uid() = user_id
   ```

2. **Teachers/Admins can view all assignments**
   ```sql
   WHERE role IN ('teacher', 'admin')
   ```

3. **Only teachers/admins can create assignments**

4. **Students can update their own assignment status**
   - But cannot change user_id, exercise_id, or assigned_by

5. **Only teachers/admins can delete assignments**

## Future Enhancements

Potential features to add:

- [ ] **Teacher Dashboard**: Dedicated view for managing all assigned exercises
- [ ] **Bulk Assignment**: Assign to multiple students at once
- [ ] **Assignment Templates**: Save common assignment configurations
- [ ] **Notifications**: Email/push notifications when new assignment is created
- [ ] **Retry Limits**: Limit how many times students can attempt
- [ ] **Time Limits**: Set maximum time allowed for completion
- [ ] **Auto-assign Based on Performance**: Automatically assign remedial work
- [ ] **Assignment History**: View past assignments and trends
- [ ] **Comments/Feedback**: Teacher can add comments after student completes
- [ ] **Attachment Support**: Attach additional resources to assignments

## Troubleshooting

### Assignment not showing up for student

**Check:**
1. Did the SQL migration run successfully?
2. Is the exercise ID correct?
3. Is the student user ID correct?
4. Check RLS policies are enabled

**Query to verify:**
```sql
SELECT * FROM individual_exercise_assignments
WHERE user_id = 'student-uuid'
AND exercise_id = 'exercise-uuid';
```

### "Duplicate assignment" error

**Cause**: A student can only have one assignment per exercise

**Solution**:
- Delete the old assignment first, OR
- Use a different exercise

### Student can't update status

**Check**: RLS policy allows students to update their own assignments

**Fix**:
```sql
-- Ensure this policy exists
CREATE POLICY "Students can update their assignment status"
ON individual_exercise_assignments FOR UPDATE
USING (auth.uid() = user_id);
```

### Widget not showing on dashboard

**Causes**:
1. Widget only shows if student has active assignments
2. Widget component not imported in Dashboard

**Fix**: Import and add `<PersonalAssignmentsWidget />` to Dashboard

## File Structure

```
src/
├── hooks/
│   └── useIndividualAssignments.jsx     ← Hook for managing assignments
├── components/
│   ├── admin/
│   │   └── AssignToStudentModal.jsx     ← Modal for assigning
│   ├── study/
│   │   └── PersonalAssignments.jsx      ← Student view
│   └── dashboard/
│       └── PersonalAssignmentsWidget.jsx ← Dashboard widget
└── supabase/
    └── add_individual_assignments.sql    ← Database migration
```

## Testing Checklist

- [ ] Run SQL migration successfully
- [ ] Create an individual assignment as teacher
- [ ] View assignment as student
- [ ] Start an assigned exercise
- [ ] Complete an assigned exercise
- [ ] Check status updates correctly
- [ ] Verify due date warnings work
- [ ] Test overdue assignments display
- [ ] Test priority levels display correctly
- [ ] Verify teacher notes show up
- [ ] Test filtering (all, new, in progress, completed)
- [ ] Verify can't assign same exercise twice to same student
- [ ] Test dashboard widget shows correct counts

---

**Created by**: Claude Code Assistant
**Last Updated**: 2025
**Version**: 1.0
