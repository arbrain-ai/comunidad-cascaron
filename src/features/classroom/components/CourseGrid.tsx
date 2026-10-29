'use client';

import { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Course } from '../types';
import { CourseCard } from './CourseCard';
import { AccessCheckResult } from '../services/classroomService';

interface SortableCourseCardProps {
  course: Course;
  progress?: number;
  lessonCount?: number;
  completedCount?: number;
  isAdmin?: boolean;
  accessResult?: AccessCheckResult;
  onEdit?: (course: Course) => void;
  onDelete?: (courseId: string) => void;
  onClick?: (course: Course) => void;
  onLockedClick?: (course: Course) => void;
}

function SortableCourseCard({ course, ...props }: SortableCourseCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: course.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
    >
      <CourseCard
        course={course}
        isDragging={isDragging}
        {...props}
      />
    </div>
  );
}

interface CourseGridProps {
  courses: Course[];
  progressMap?: Record<string, number>;
  lessonCountsMap?: Record<string, number>;
  completedCountsMap?: Record<string, number>;
  accessResultsMap?: Record<string, AccessCheckResult>;
  isAdmin?: boolean;
  onEdit?: (course: Course) => void;
  onDelete?: (courseId: string) => void;
  onClick?: (course: Course) => void;
  onLockedClick?: (course: Course) => void;
  onReorder?: (courseIds: string[]) => void;
  onCreate?: () => void;
}

export function CourseGrid({
  courses,
  progressMap = {},
  lessonCountsMap = {},
  completedCountsMap = {},
  accessResultsMap = {},
  isAdmin = false,
  onEdit,
  onDelete,
  onClick,
  onLockedClick,
  onReorder,
  onCreate,
}: CourseGridProps) {
  const [items, setItems] = useState(courses);

  // Sync items when courses prop changes
  useEffect(() => {
    setItems(courses);
  }, [courses]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Requires 8px movement before starting drag
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);

        // Notify parent about reorder
        onReorder?.(newItems.map((i) => i.id));

        return newItems;
      });
    }
  };

  // Create course card component
  const CreateCourseCard = () => (
    <button
      onClick={onCreate}
      className="card-interactive h-full min-h-[280px] w-full border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/50 flex flex-col items-center justify-center gap-3 group"
    >
      <div className="w-12 h-12 rounded-full bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center transition-colors">
        <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </div>
      <span className="text-sm font-medium text-muted group-hover:text-foreground transition-colors">
        New course
      </span>
    </button>
  );

  if (items.length === 0 && isAdmin) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        <CreateCourseCard />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="solid-card p-12 text-center">
        <div className="text-4xl mb-4">📚</div>
        <p className="text-muted">No hay cursos disponibles</p>
      </div>
    );
  }

  // If admin, enable drag & drop
  if (isAdmin) {
    return (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={items.map((i) => i.id)}
          strategy={rectSortingStrategy}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {items.map((course) => (
              <SortableCourseCard
                key={course.id}
                course={course}
                progress={progressMap[course.id] || 0}
                lessonCount={lessonCountsMap[course.id]}
                completedCount={completedCountsMap[course.id]}
                isAdmin={isAdmin}
                accessResult={accessResultsMap[course.id]}
                onEdit={onEdit}
                onDelete={onDelete}
                onClick={onClick}
                onLockedClick={onLockedClick}
              />
            ))}
            {onCreate && <CreateCourseCard />}
          </div>
        </SortableContext>
      </DndContext>
    );
  }

  // Regular grid without drag & drop for non-admins
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
      {items.map((course) => (
        <CourseCard
          key={course.id}
          course={course}
          progress={progressMap[course.id] || 0}
          lessonCount={lessonCountsMap[course.id]}
          completedCount={completedCountsMap[course.id]}
          isAdmin={false}
          accessResult={accessResultsMap[course.id]}
          onClick={onClick}
          onLockedClick={onLockedClick}
        />
      ))}
    </div>
  );
}
