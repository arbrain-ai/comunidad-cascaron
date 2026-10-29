'use client';

import { useState, useRef, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  useDroppable,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Lesson, FolderWithLessons } from '../types';
import { InputModal } from '@/shared/components/InputModal';

interface CourseSidebarProps {
  courseTitle: string;
  folders: FolderWithLessons[];
  standaloneLessons: Lesson[];
  selectedLessonId?: string;
  isAdmin: boolean;
  progress?: number; // 0-100 percentage
  completedLessons?: Set<string>;
  onLessonSelect: (lesson: Lesson) => void;
  onAddFolder: () => void;
  onAddPage: (folderId?: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onDeleteLesson: (lessonId: string) => void;
  onUpdateLessonTitle: (lesson: Lesson) => void;
  onUpdateFolderTitle: (folderId: string, newTitle: string) => void;
  onReorderFolders: (folderIds: string[]) => void;
  onReorderLessons: (lessonIds: string[], folderId?: string) => void;
  onReorderCourseItems?: (items: Array<{ id: string; type: 'folder' | 'lesson'; order: number }>) => void;
  onMoveLesson: (lessonId: string, targetFolderId: string | null) => void;
  onBack?: () => void;
  onToggleFolderPublished?: (folderId: string, published: boolean) => void;
  onToggleLessonPublished?: (lessonId: string, published: boolean) => void;
}

// Sortable Lesson Item
function SortableLessonItem({
  lesson,
  index,
  isSelected,
  isAdmin,
  isCompleted,
  onSelect,
  onEdit,
  onDelete,
  onTogglePublished,
}: {
  lesson: Lesson;
  index: number;
  isSelected: boolean;
  isAdmin: boolean;
  isCompleted?: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePublished?: (published: boolean) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lesson.id, data: { type: 'lesson', folderId: lesson.folder_id } });

  // Close menu on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        group relative flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-200
        ${isSelected
          ? 'bg-primary/15 text-foreground border-l-[3px] border-l-primary ml-0 pl-[9px]'
          : 'hover:bg-primary/10 text-muted border-l-[3px] border-l-transparent'
        }
      `}
      onClick={onSelect}
      onContextMenu={(e) => {
        if (isAdmin) {
          e.preventDefault();
          setShowMenu(true);
        }
      }}
      {...(isAdmin ? { ...attributes, ...listeners } : {})}
    >
      <div className="flex items-center gap-2 min-w-0">
        {isAdmin && (
          <span className="text-muted/50 cursor-grab">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm-2 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm8-14a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm-2 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm2 4a2 2 0 1 1-4 0 2 2 0 0 1 4 0z"/>
            </svg>
          </span>
        )}
        {isCompleted ? (
          <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        ) : (
          <span className="text-xs text-muted/70 flex-shrink-0">{index + 1}.</span>
        )}
        <span className="text-sm line-clamp-2 leading-tight">{lesson.title}</span>
        {lesson.published === false && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-warning/20 text-warning ml-1 flex-shrink-0">
            Draft
          </span>
        )}
      </div>

      {/* Context Menu */}
      {isAdmin && showMenu && (
        <div
          ref={menuRef}
          className="absolute right-0 top-full mt-1 w-44 glass-panel-strong rounded-lg shadow-lg border border-border/30 py-1 z-50"
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
              setShowMenu(false);
            }}
            className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-surface-elevated flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Edit page
          </button>
          {onTogglePublished && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTogglePublished(!(lesson.published ?? true));
                setShowMenu(false);
              }}
              className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-surface-elevated flex items-center gap-2"
            >
              {lesson.published === false ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Publicar
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                  Convertir a borrador
                </>
              )}
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              // TODO: Add duplicate handler
              setShowMenu(false);
            }}
            className="w-full px-3 py-2 text-left text-sm text-muted/50 hover:bg-surface-elevated flex items-center gap-2 cursor-not-allowed"
            disabled
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Duplicate page
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
              setShowMenu(false);
            }}
            className="w-full px-3 py-2 text-left text-sm text-error hover:bg-surface-elevated flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete page
          </button>
        </div>
      )}
    </div>
  );
}

// Sortable Folder with droppable area for lessons
function SortableFolder({
  folder,
  selectedLessonId,
  isAdmin,
  completedLessons,
  onLessonSelect,
  onAddPage,
  onDeleteFolder,
  onDeleteLesson,
  onUpdateLessonTitle,
  onUpdateFolderTitle,
  onToggleFolderPublished,
  onToggleLessonPublished,
}: {
  folder: FolderWithLessons;
  selectedLessonId?: string;
  isAdmin: boolean;
  completedLessons?: Set<string>;
  onLessonSelect: (lesson: Lesson) => void;
  onAddPage: (folderId: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onDeleteLesson: (lessonId: string) => void;
  onUpdateLessonTitle: (lesson: Lesson) => void;
  onUpdateFolderTitle: (folderId: string, newTitle: string) => void;
  onToggleFolderPublished?: (folderId: string, published: boolean) => void;
  onToggleLessonPublished?: (lessonId: string, published: boolean) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [editFolderModal, setEditFolderModal] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: folder.id, data: { type: 'folder' } });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `folder-drop-${folder.id}`,
    data: { type: 'folder-drop', folderId: folder.id },
  });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="space-y-1">
      {/* Folder header */}
      <div
        className={`
          group flex items-center justify-between px-3 py-2.5 text-sm rounded-lg transition-all duration-200
          ${isOver ? 'bg-primary/15 border border-primary/30' : 'hover:bg-primary/10'}
        `}
        onContextMenu={(e) => {
          if (isAdmin) {
            e.preventDefault();
            setShowMenu(true);
          }
        }}
      >
        <div
          className="flex items-center gap-2 flex-1 cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isAdmin && (
            <span
              className="text-muted/50 cursor-grab"
              {...attributes}
              {...listeners}
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm-2 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm8-14a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm-2 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm2 4a2 2 0 1 1-4 0 2 2 0 0 1 4 0z"/>
              </svg>
            </span>
          )}
          <svg
            className={`w-4 h-4 text-muted transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <svg className="w-4 h-4 text-yellow-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
            <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <span className="font-medium text-foreground line-clamp-2 leading-tight">{folder.title}</span>
          <span className="text-xs text-muted flex-shrink-0">({folder.lessons.length})</span>
          {folder.published === false && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-warning/20 text-warning ml-1 flex-shrink-0">
              Draft
            </span>
          )}
        </div>

        {isAdmin && (
          <div ref={menuRef} className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="p-1 hover:bg-surface-elevated rounded opacity-0 group-hover:opacity-100 hover:opacity-100"
            >
              <svg className="w-4 h-4 text-muted" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="6" r="1.5" />
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="12" cy="18" r="1.5" />
              </svg>
            </button>

            {showMenu && (
              <div className="absolute right-0 mt-1 w-44 glass-panel-strong rounded-lg shadow-lg border border-border/30 py-1 z-50">
                <button
                  onClick={() => {
                    setEditFolderModal(true);
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-surface-elevated flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  Edit folder
                </button>
                {onToggleFolderPublished && (
                  <button
                    onClick={() => {
                      onToggleFolderPublished(folder.id, !(folder.published ?? true));
                      setShowMenu(false);
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-surface-elevated flex items-center gap-2"
                  >
                    {folder.published === false ? (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        Publicar
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                        Convertir a borrador
                      </>
                    )}
                  </button>
                )}
                <button
                  onClick={() => {
                    onAddPage(folder.id);
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-surface-elevated flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                  </svg>
                  Add page in folder
                </button>
                <button
                  onClick={() => {
                    // TODO: Add duplicate folder handler
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-muted/50 hover:bg-surface-elevated flex items-center gap-2 cursor-not-allowed"
                  disabled
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Duplicate folder
                </button>
                <button
                  onClick={() => {
                    onDeleteFolder(folder.id);
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-error hover:bg-surface-elevated flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete folder
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Folder content (lessons) */}
      {isExpanded && (
        <div ref={setDropRef} className="pl-4 space-y-1 min-h-[20px]">
          <SortableContext
            items={folder.lessons.map(l => l.id)}
            strategy={verticalListSortingStrategy}
          >
            {folder.lessons.map((lesson, index) => (
              <SortableLessonItem
                key={lesson.id}
                lesson={lesson}
                index={index}
                isSelected={selectedLessonId === lesson.id}
                isAdmin={isAdmin}
                isCompleted={completedLessons?.has(lesson.id)}
                onSelect={() => onLessonSelect(lesson)}
                onEdit={() => onUpdateLessonTitle(lesson)}
                onDelete={() => onDeleteLesson(lesson.id)}
                onTogglePublished={onToggleLessonPublished ? (published) => onToggleLessonPublished(lesson.id, published) : undefined}
              />
            ))}
          </SortableContext>
          {folder.lessons.length === 0 && (
            <div className="text-xs text-muted/50 py-2 text-center italic">
              Drop pages here
            </div>
          )}
        </div>
      )}

      {/* Edit Folder Modal */}
      <InputModal
        isOpen={editFolderModal}
        onClose={() => setEditFolderModal(false)}
        onConfirm={(newTitle) => {
          if (newTitle && newTitle !== folder.title) {
            onUpdateFolderTitle(folder.id, newTitle);
          }
        }}
        title="Editar carpeta"
        placeholder="Nombre de la carpeta"
        defaultValue={folder.title}
        label="Nombre"
        maxLength={100}
      />
    </div>
  );
}

export function CourseSidebar({
  courseTitle,
  folders,
  standaloneLessons,
  selectedLessonId,
  isAdmin,
  progress = 0,
  completedLessons,
  onLessonSelect,
  onAddFolder,
  onAddPage,
  onDeleteFolder,
  onDeleteLesson,
  onUpdateLessonTitle,
  onUpdateFolderTitle,
  onReorderFolders,
  onReorderLessons,
  onReorderCourseItems,
  onMoveLesson,
  onBack,
  onToggleFolderPublished,
  onToggleLessonPublished,
}: CourseSidebarProps) {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);

  const { setNodeRef: setStandaloneDropRef, isOver: isOverStandalone } = useDroppable({
    id: 'standalone-drop',
    data: { type: 'standalone-drop' },
  });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (addMenuRef.current && !addMenuRef.current.contains(event.target as Node)) {
        setShowAddMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Create unified items array for inline mixing
  type UnifiedItem =
    | { type: 'folder'; data: FolderWithLessons; order: number }
    | { type: 'standalone-lesson'; data: Lesson; order: number };

  const unifiedItems: UnifiedItem[] = [
    ...folders.map(f => ({ type: 'folder' as const, data: f, order: f.order_position ?? 0 })),
    ...standaloneLessons.map(l => ({ type: 'standalone-lesson' as const, data: l, order: l.order_position ?? 0 }))
  ].sort((a, b) => a.order - b.order);

  const unifiedItemIds = unifiedItems.map(item =>
    item.type === 'folder' ? item.data.id : item.data.id
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;

    if (!over) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    // Determine if items are in unified context (folders or standalone lessons)
    const activeIsFolder = activeData?.type === 'folder';
    const activeIsStandalone = activeData?.type === 'lesson' && !activeData.folderId;
    const overIsFolder = overData?.type === 'folder';
    const overIsStandalone = overData?.type === 'lesson' && !overData.folderId;

    // Handle unified reordering (folders and standalone lessons mixed)
    if ((activeIsFolder || activeIsStandalone) && (overIsFolder || overIsStandalone)) {
      const oldIndex = unifiedItems.findIndex(item =>
        (item.type === 'folder' && item.data.id === active.id) ||
        (item.type === 'standalone-lesson' && item.data.id === active.id)
      );
      const newIndex = unifiedItems.findIndex(item =>
        (item.type === 'folder' && item.data.id === over.id) ||
        (item.type === 'standalone-lesson' && item.data.id === over.id)
      );

      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const newItems = arrayMove(unifiedItems, oldIndex, newIndex);

        // Use unified reorder if available, otherwise fall back to separate handlers
        if (onReorderCourseItems) {
          const updates = newItems.map((item, globalOrder) => ({
            id: item.data.id,
            type: item.type === 'folder' ? ('folder' as const) : ('lesson' as const),
            order: globalOrder
          }));
          onReorderCourseItems(updates);
        } else {
          // Fallback: update each type separately (less efficient but maintains compatibility)
          const folderUpdates: string[] = [];
          const lessonUpdates: string[] = [];

          newItems.forEach((item) => {
            if (item.type === 'folder') {
              folderUpdates.push(item.data.id);
            } else {
              lessonUpdates.push(item.data.id);
            }
          });

          if (folderUpdates.length > 0) {
            onReorderFolders(folderUpdates);
          }
          if (lessonUpdates.length > 0) {
            onReorderLessons(lessonUpdates);
          }
        }
      }
      return;
    }

    // Handle lesson moving to folder
    if (activeData?.type === 'lesson') {
      const lessonId = active.id as string;

      // Dropped on a folder drop zone
      if (overData?.type === 'folder-drop') {
        const targetFolderId = overData.folderId as string;
        if (activeData.folderId !== targetFolderId) {
          onMoveLesson(lessonId, targetFolderId);
        }
        return;
      }

      // Dropped on standalone area
      if (overData?.type === 'standalone-drop' || over.id === 'standalone-drop') {
        if (activeData.folderId) {
          onMoveLesson(lessonId, null);
        }
        return;
      }

      // Reordering within same folder
      if (overData?.type === 'lesson') {
        const activeFolderId = activeData.folderId;
        const overFolderId = overData.folderId;

        if (activeFolderId === overFolderId && activeFolderId) {
          // Same folder (not standalone)
          const lessonsArray = folders.find(f => f.id === activeFolderId)?.lessons || [];

          const oldIndex = lessonsArray.findIndex(l => l.id === active.id);
          const newIndex = lessonsArray.findIndex(l => l.id === over.id);

          if (oldIndex !== newIndex) {
            const newLessons = arrayMove(lessonsArray, oldIndex, newIndex);
            onReorderLessons(newLessons.map(l => l.id), activeFolderId);
          }
        } else if (activeFolderId !== overFolderId) {
          // Moving between different folders/standalone
          onMoveLesson(lessonId, overFolderId || null);
        }
      }
    }
  };

  // Find active lesson for drag overlay
  const activeLesson = activeId
    ? [...standaloneLessons, ...folders.flatMap(f => f.lessons)].find(l => l.id === activeId)
    : null;

  const activeFolder = activeId && !activeLesson
    ? folders.find(f => f.id === activeId)
    : null;

  return (
    <div className="font-sans w-full h-full border-r border-glass flex flex-col bg-surface/40 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-glass flex-shrink-0">
        {/* Back button */}
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-muted hover:text-primary transition-colors duration-200 mb-3 group"
          >
            <svg className="w-4 h-4 transition-transform duration-200 group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm">All Courses</span>
          </button>
        )}
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-black text-foreground truncate">{courseTitle}</h2>
          {isAdmin && (
            <div ref={addMenuRef} className="relative">
              <button
                onClick={() => setShowAddMenu(!showAddMenu)}
                className="p-1.5 hover:bg-surface-elevated rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-muted hover:text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>

              {showAddMenu && (
                <div className="absolute right-0 mt-2 w-44 glass-panel-strong rounded-lg shadow-lg border border-border/30 py-1 z-50">
                  <button
                    onClick={() => {
                      onAddFolder();
                      setShowAddMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-surface-elevated flex items-center gap-2"
                  >
                    <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    New folder
                  </button>
                  <button
                    onClick={() => {
                      onAddPage();
                      setShowAddMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-surface-elevated flex items-center gap-2"
                  >
                    <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    New page
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted">{Math.round(progress)}% complete</span>
          </div>
          <div className="h-1.5 w-full bg-muted/30 rounded-full overflow-hidden border border-glass">
            <div
              className="h-full bg-gradient-to-r from-primary to-neon-purple rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {/* Unified items (folders and standalone lessons mixed) */}
          <SortableContext
            items={unifiedItemIds}
            strategy={verticalListSortingStrategy}
          >
            {unifiedItems.map((item, globalIndex) => {
              if (item.type === 'folder') {
                return (
                  <SortableFolder
                    key={item.data.id}
                    folder={item.data}
                    selectedLessonId={selectedLessonId}
                    isAdmin={isAdmin}
                    completedLessons={completedLessons}
                    onLessonSelect={onLessonSelect}
                    onAddPage={onAddPage}
                    onDeleteFolder={onDeleteFolder}
                    onDeleteLesson={onDeleteLesson}
                    onUpdateLessonTitle={onUpdateLessonTitle}
                    onUpdateFolderTitle={onUpdateFolderTitle}
                    onToggleFolderPublished={onToggleFolderPublished}
                    onToggleLessonPublished={onToggleLessonPublished}
                  />
                );
              } else {
                // Calculate index among standalone lessons only
                const standaloneIndex = unifiedItems
                  .slice(0, globalIndex)
                  .filter(i => i.type === 'standalone-lesson')
                  .length;

                return (
                  <SortableLessonItem
                    key={item.data.id}
                    lesson={item.data}
                    index={standaloneIndex}
                    isSelected={selectedLessonId === item.data.id}
                    isAdmin={isAdmin}
                    isCompleted={completedLessons?.has(item.data.id)}
                    onSelect={() => onLessonSelect(item.data)}
                    onEdit={() => onUpdateLessonTitle(item.data)}
                    onDelete={() => onDeleteLesson(item.data.id)}
                    onTogglePublished={onToggleLessonPublished ? (published) => onToggleLessonPublished(item.data.id, published) : undefined}
                  />
                );
              }
            })}
          </SortableContext>

          {/* Drag overlay */}
          <DragOverlay>
            {activeLesson && (
              <div className="px-3 py-2.5 bg-card/90 backdrop-blur-sm rounded-lg shadow-xl border border-primary/30 shadow-[0_0_20px_rgba(104,58,204,0.15)]">
                <span className="text-sm text-foreground">{activeLesson.title}</span>
              </div>
            )}
            {activeFolder && (
              <div className="px-3 py-2.5 bg-card/90 backdrop-blur-sm rounded-lg shadow-xl border border-primary/30 shadow-[0_0_20px_rgba(104,58,204,0.15)] flex items-center gap-2">
                <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                <span className="text-sm text-foreground font-medium">{activeFolder.title}</span>
              </div>
            )}
          </DragOverlay>
        </DndContext>

        {/* Empty state */}
        {unifiedItems.length === 0 && (
          <div className="text-center py-8 text-muted">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm">No content yet</p>
            {isAdmin && (
              <button
                onClick={() => onAddPage()}
                className="mt-3 text-sm text-primary hover:underline"
              >
                + Add first page
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
