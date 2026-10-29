'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { useFocusMode } from '@/shared/contexts/FocusModeContext';
import { hasAdminAccess } from '@/shared/constants/roles';
import { PageEditor } from '@/features/classroom/components/PageEditor';
import { CourseSidebar } from '@/features/classroom/components/CourseSidebar';
import { LinkedPostEmbed } from '@/features/classroom/components/LinkedPostEmbed';
import { CourseWithContent, Lesson, FolderWithLessons } from '@/features/classroom/types';
import {
  getCourseWithContent,
  fetchAccessContext,
  resolveCoursesAccess,
  AccessContext,
  createLesson,
  updateLesson,
  deleteLesson,
  createFolder,
  updateFolder,
  deleteFolder,
  reorderFolders,
  reorderLessons,
  reorderCourseItems,
  moveLesson,
  markLessonComplete,
  toggleFolderPublished,
  toggleLessonPublished,
} from '@/features/classroom/services/classroomService';
import { CourseViewSkeleton } from '@/features/classroom/components/CourseSkeletons';
import { supabase } from '@/shared/lib/supabase';
import { useToast } from '@/shared/hooks/useToast';
import { InputModal } from '@/shared/components/InputModal';
import { UnsavedChangesModal, UnsavedChangesAction } from '@/shared/components/UnsavedChangesModal';
import { CierreLeccion } from '@/features/classroom/components/CierreLeccion';
import { splitLessonContent } from '@/features/classroom/utils/sanitizeLesson';
import LessonHtml from '@/features/classroom/components/LessonHtml';

const SIDEBAR_WIDTH = 340;

// Helper to get all lessons in display order (standalone + folder lessons interleaved by order_position)
function getAllLessonsOrdered(course: CourseWithContent): Lesson[] {
  // Combine folders and standalone lessons, then sort by order_position
  const allItems: Array<{ type: 'folder' | 'lesson'; item: FolderWithLessons | Lesson; order: number }> = [
    ...course.folders.map(f => ({ type: 'folder' as const, item: f, order: f.order_position ?? 0 })),
    ...course.standaloneLessons.map(l => ({ type: 'lesson' as const, item: l, order: l.order_position ?? 0 })),
  ];

  allItems.sort((a, b) => a.order - b.order);

  const orderedLessons: Lesson[] = [];
  for (const entry of allItems) {
    if (entry.type === 'folder') {
      // Add all lessons from folder in their order
      const folder = entry.item as FolderWithLessons;
      const sortedLessons = [...folder.lessons].sort((a, b) => (a.order_position ?? 0) - (b.order_position ?? 0));
      orderedLessons.push(...sortedLessons);
    } else {
      orderedLessons.push(entry.item as Lesson);
    }
  }

  return orderedLessons;
}

export default function CourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userProfile, isLoading: isLoadingAuth } = useUserProfile();
  const { showSuccess, showError } = useToast();
  const courseId = params.courseId as string;
  const lessonParam = searchParams.get('lesson');

  const [course, setCourse] = useState<CourseWithContent | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lessonContent, setLessonContent] = useState('');
  const [lessonAttachments, setLessonAttachments] = useState<any[]>([]);
  const [courseProgress, setCourseProgress] = useState(0);
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(new Set());

  // Modal states
  const [addPageModal, setAddPageModal] = useState<{ isOpen: boolean; folderId?: string }>({ isOpen: false });
  const [addFolderModal, setAddFolderModal] = useState(false);
  const [editLessonModal, setEditLessonModal] = useState<{ isOpen: boolean; lesson?: Lesson }>({ isOpen: false });
  const [unsavedChangesModal, setUnsavedChangesModal] = useState<{ isOpen: boolean; pendingLesson?: Lesson }>({ isOpen: false });

  // Manual save state (simple and reliable)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSavingManual, setIsSavingManual] = useState(false);
  const originalContent = useRef<{ content: string; attachments: any[] } | null>(null);
  const contentAreaRef = useRef<HTMLDivElement>(null);
  // Lecciones con un toggle de completado en vuelo: bloquea el doble-click que
  // dispararía complete+incomplete sobre la misma lección (carrera de red que
  // podía dejar la UI incoherente con el servidor, "last response wins").
  const togglingLessonsRef = useRef<Set<string>>(new Set());

  const isAdmin = hasAdminAccess(userProfile?.role || '');
  // Cursos v2 (30 ago 2026): la rama v2 PREFIERE content_v2 (marcador narrador → página HTML
  // completa) y deja `content` intacto para producción (main). Un guardado sobre una lección v2
  // escribe content_v2, nunca content: content es el rollback.
  const contenidoVisible = (l: { content?: string | null; content_v2?: string | null } | null | undefined) =>
    (l?.content_v2 && l.content_v2.trim()) ? l.content_v2 : (l?.content || '');
  const { isFocusMode, toggleFocusMode } = useFocusMode();
  // Alto REAL del header (nav + fila de pestañas): el área del curso llega justo debajo. El 80px
  // fijo de antes dejaba 40px del marco cortados por debajo de la ventana (medido 30 ago 2026).
  const [navBottom, setNavBottom] = useState(80);
  useEffect(() => {
    const mide = () => {
      const nav = document.querySelector('nav.titanium-header');
      const b = nav ? Math.round(nav.getBoundingClientRect().bottom) : 80;
      setNavBottom((v) => (Math.abs(v - b) > 1 ? b : v));
    };
    mide();
    window.addEventListener('resize', mide);
    const t = window.setInterval(mide, 1500);
    return () => { window.removeEventListener('resize', mide); window.clearInterval(t); };
  }, []);

  // Sidebar collapse state - auto-collapse on mobile
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [pildoraOculta, setPildoraOculta] = useState(false);
  const ultimoScrollRef = useRef(0);
  const sidebarStateBeforeFocus = useRef<boolean | null>(null);

  // Auto-collapse sidebar on mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      if (window.innerWidth < 768) {
        setIsCollapsed(true);
      }
    };
    checkMobile(); // Check on mount
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Auto-collapse sidebar in focus mode, restore on exit
  useEffect(() => {
    if (isFocusMode) {
      // Entering focus mode - save current state and collapse
      sidebarStateBeforeFocus.current = isCollapsed;
      setIsCollapsed(true);
    } else if (sidebarStateBeforeFocus.current !== null) {
      // Exiting focus mode - restore previous state
      setIsCollapsed(sidebarStateBeforeFocus.current);
      sidebarStateBeforeFocus.current = null;
    }
  // Only run when isFocusMode changes, not when isCollapsed changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocusMode]);

  // Fetch course data and progress
  useEffect(() => {
    if (isLoadingAuth || !userProfile) return;

    async function fetchCourse() {
      if (!userProfile) return;

      try {
        // Admins ven todo (incluye drafts), members solo ven published
        const includeUnpublished = hasAdminAccess(userProfile.role || '');

        // El contenido del curso y el contexto de acceso del usuario NO
        // dependen entre sí: antes el gate esperaba a que llegara el curso
        // para recién entonces salir a la red (dos round-trips en serie).
        // Ahora salen juntos y el veredicto se resuelve sin tocar la red.
        const [data, accessContext] = await Promise.all([
          getCourseWithContent(courseId, includeUnpublished),
          includeUnpublished
            ? Promise.resolve<AccessContext | null>(null)
            : fetchAccessContext(userProfile.id, userProfile).catch(() => null),
        ]);

        // Gate de acceso: misma decisión que usa la lista de /classroom para
        // pintar candados. Sin esto, cualquier miembro leía TODO el contenido
        // por URL directa (rompía la escalera del anual). Si el contexto falló,
        // resolveCoursesAccess deja el curso CERRADO — nunca abierto.
        const access = resolveCoursesAccess([data], userProfile, accessContext)[data.id];
        if (!access?.hasAccess) {
          router.replace('/classroom');
          return;
        }

        setCourse(data);

        // Get all lessons from course
        const allLessons = [
          ...data.standaloneLessons,
          ...data.folders.flatMap(f => f.lessons)
        ];

        // Priority: query param ?lesson= → localStorage → first lesson
        let lessonToSelect = null;

        if (lessonParam) {
          lessonToSelect = allLessons.find(l => l.id === lessonParam);
        }

        if (!lessonToSelect) {
          const lastViewedLessonId = localStorage.getItem(`course_${courseId}_last_lesson`);
          if (lastViewedLessonId) {
            lessonToSelect = allLessons.find(l => l.id === lastViewedLessonId);
          }
        }

        // Fallback to first lesson if no saved lesson or lesson not found
        if (!lessonToSelect) {
          lessonToSelect = data.standaloneLessons[0] || data.folders[0]?.lessons[0];
        }

        if (lessonToSelect) {
          setSelectedLesson(lessonToSelect);
          setLessonContent(contenidoVisible(lessonToSelect));
          setLessonAttachments((lessonToSelect.attachments as any[]) || []);
          originalContent.current = {
            content: contenidoVisible(lessonToSelect),
            attachments: (lessonToSelect.attachments as any[]) || [],
          };
          setHasUnsavedChanges(false);
        }

        // Una sola query para completadas; el % se computa local con la misma
        // fórmula que usa handleMarkComplete (antes eran 3 queries extra)
        const lessonIds = allLessons.map(l => l.id);

        const { data: completedData } = await supabase
          .from('lesson_progress')
          .select('lesson_id')
          .eq('user_id', userProfile.id)
          .in('lesson_id', lessonIds)
          .eq('completed', true);

        const completedSet = new Set<string>((completedData || []).map(c => c.lesson_id));
        setCompletedLessons(completedSet);
        setCourseProgress(
          allLessons.length > 0 ? Math.round((completedSet.size / allLessons.length) * 100) : 0
        );
      } catch (error) {
        console.error('Error fetching course:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchCourse();
  }, [courseId, isLoadingAuth, userProfile, lessonParam, router]);

  // Track content changes (simple comparison against original)
  // PageEditor now handles ignoring TipTap's internal normalization via isSyncingContent ref
  useEffect(() => {
    if (!selectedLesson || !isAdmin || !originalContent.current) return;

    const hasChanges =
      lessonContent !== originalContent.current.content ||
      JSON.stringify(lessonAttachments) !== JSON.stringify(originalContent.current.attachments || []);

    setHasUnsavedChanges(hasChanges);
  }, [lessonContent, lessonAttachments, selectedLesson, isAdmin]);

  // Auto-save when user switches tabs (prevents data loss)
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.hidden && hasUnsavedChanges && selectedLesson && isAdmin && !isSavingManual) {
        // User is leaving the tab - auto-save silently
        try {
          await updateLesson(selectedLesson.id, {
            ...(selectedLesson.content_v2 ? { content_v2: lessonContent } : { content: lessonContent }),
            attachments: lessonAttachments,
          });

          // Update original content reference
          originalContent.current = {
            content: lessonContent,
            attachments: lessonAttachments,
          };
          setHasUnsavedChanges(false);

          // Update local course state to keep in sync
          if (course) {
            const updatedCourse = { ...course };
            updatedCourse.standaloneLessons = updatedCourse.standaloneLessons.map((l) =>
              l.id === selectedLesson.id ? { ...l, content: lessonContent, attachments: lessonAttachments } : l
            );
            updatedCourse.folders = updatedCourse.folders.map((folder) => ({
              ...folder,
              lessons: folder.lessons.map((l) =>
                l.id === selectedLesson.id ? { ...l, content: lessonContent, attachments: lessonAttachments } : l
              ),
            }));
            setCourse(updatedCourse);
          }
        } catch (error) {
          console.error('Auto-save on tab switch failed:', error);
          // Don't show alert - user is already leaving, just log the error
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [hasUnsavedChanges, selectedLesson, lessonContent, lessonAttachments, isAdmin, isSavingManual, course]);

  // Warn user before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Manual save function (used by save button and Ctrl+S)
  const handleSaveLesson = useCallback(async () => {
    if (!selectedLesson || !hasUnsavedChanges) return;

    setIsSavingManual(true);
    try {
      await updateLesson(selectedLesson.id, {
        ...(selectedLesson.content_v2 ? { content_v2: lessonContent } : { content: lessonContent }),
        attachments: lessonAttachments,
      });

      // Update local state
      if (course) {
        const updatedCourse = { ...course };
        updatedCourse.standaloneLessons = updatedCourse.standaloneLessons.map((l) =>
          l.id === selectedLesson.id ? { ...l, content: lessonContent, attachments: lessonAttachments } : l
        );
        updatedCourse.folders = updatedCourse.folders.map((folder) => ({
          ...folder,
          lessons: folder.lessons.map((l) =>
            l.id === selectedLesson.id ? { ...l, content: lessonContent, attachments: lessonAttachments } : l
          ),
        }));
        setCourse(updatedCourse);
        setSelectedLesson({ ...selectedLesson, content: lessonContent, attachments: lessonAttachments });
      }

      // Update original content reference after successful save
      originalContent.current = {
        content: lessonContent,
        attachments: lessonAttachments,
      };
      setHasUnsavedChanges(false);
    } catch (error) {
      const errorDetails = error instanceof Error
        ? { message: error.message, name: error.name }
        : error;
      console.error('Error saving lesson:', JSON.stringify(errorDetails, null, 2));
      alert('Error al guardar la lección');
    } finally {
      setIsSavingManual(false);
    }
  }, [selectedLesson, hasUnsavedChanges, lessonContent, lessonAttachments, course]);

  // Keyboard shortcut: Cmd+S / Ctrl+S to save manually
  useEffect(() => {
    if (!isAdmin) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+S (Mac) or Ctrl+S (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault(); // Prevent browser's default save dialog
        handleSaveLesson();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAdmin, handleSaveLesson]); // handleSaveLesson is memoized with useCallback

  // Actually switch to a new lesson (used after save/discard decision)
  const switchToLesson = useCallback((lesson: Lesson) => {
    setSelectedLesson(lesson);
    setLessonContent(contenidoVisible(lesson));
    setLessonAttachments((lesson.attachments as any[]) || []);

    // Reset to new lesson's original content
    originalContent.current = {
      content: contenidoVisible(lesson),
      attachments: (lesson.attachments as any[]) || [],
    };
    setHasUnsavedChanges(false);

    // Persist selected lesson to localStorage
    localStorage.setItem(`course_${courseId}_last_lesson`, lesson.id);

    // En móvil el sidebar es un drawer overlay: se cierra al elegir lección
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsCollapsed(true);
    }

    // Scroll to top when switching lessons
    contentAreaRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [courseId]);

  const handleLessonSelect = (lesson: Lesson) => {
    // Block if save is in progress
    if (isSaving || isSavingManual) {
      return;
    }

    // Show modal if there are unsaved changes
    if (hasUnsavedChanges) {
      setUnsavedChangesModal({ isOpen: true, pendingLesson: lesson });
      return;
    }

    // No unsaved changes - switch directly
    switchToLesson(lesson);
  };

  // Handle unsaved changes modal actions
  const handleUnsavedChangesAction = async (action: UnsavedChangesAction) => {
    const pendingLesson = unsavedChangesModal.pendingLesson;

    if (action === 'cancel') {
      setUnsavedChangesModal({ isOpen: false });
      return;
    }

    if (action === 'save') {
      // Save first, then switch
      setIsSavingManual(true);
      try {
        if (selectedLesson) {
          await updateLesson(selectedLesson.id, {
            ...(selectedLesson.content_v2 ? { content_v2: lessonContent } : { content: lessonContent }),
            attachments: lessonAttachments,
          });

          // Update local state
          if (course) {
            const updatedCourse = { ...course };
            updatedCourse.standaloneLessons = updatedCourse.standaloneLessons.map((l) =>
              l.id === selectedLesson.id ? { ...l, content: lessonContent, attachments: lessonAttachments } : l
            );
            updatedCourse.folders = updatedCourse.folders.map((folder) => ({
              ...folder,
              lessons: folder.lessons.map((l) =>
                l.id === selectedLesson.id ? { ...l, content: lessonContent, attachments: lessonAttachments } : l
              ),
            }));
            setCourse(updatedCourse);
          }
        }
      } catch (error) {
        console.error('Error saving lesson:', error);
        alert('Error al guardar la lección');
        setIsSavingManual(false);
        return; // Don't switch if save failed
      }
      setIsSavingManual(false);
    }

    // For both 'save' and 'discard', switch to pending lesson
    setUnsavedChangesModal({ isOpen: false });
    if (pendingLesson) {
      switchToLesson(pendingLesson);
    }
  };

  // Optimista: el check pinta al instante y se revierte solo si el servidor falla
  const handleMarkComplete = async () => {
    if (!selectedLesson || !userProfile || !course) return;

    const lessonId = selectedLesson.id;
    // Ignora clicks mientras un toggle de esta lección está en vuelo
    if (togglingLessonsRef.current.has(lessonId)) return;
    togglingLessonsRef.current.add(lessonId);

    const prevCompleted = completedLessons;
    const prevProgress = courseProgress;

    const newCompleted = new Set(completedLessons);
    newCompleted.add(lessonId);
    const allLessons = [
      ...course.standaloneLessons,
      ...course.folders.flatMap(f => f.lessons)
    ];
    const newProgress = Math.round((newCompleted.size / allLessons.length) * 100);

    setCompletedLessons(newCompleted);
    setCourseProgress(newProgress);
    if (newProgress === 100) {
      showSuccess('¡Curso completado! 🎉');
    } else {
      showSuccess(`¡Lección completada! (${newProgress}%)`);
    }

    try {
      await markLessonComplete(userProfile.id, lessonId);
    } catch (error) {
      console.error('Error marking lesson complete:', error);
      setCompletedLessons(prevCompleted);
      setCourseProgress(prevProgress);
      showError('No se pudo guardar tu progreso. Intenta de nuevo.');
    } finally {
      togglingLessonsRef.current.delete(lessonId);
    }
  };

  const handleMarkIncomplete = async () => {
    if (!selectedLesson || !userProfile || !course) return;

    const lessonId = selectedLesson.id;
    if (togglingLessonsRef.current.has(lessonId)) return;
    togglingLessonsRef.current.add(lessonId);

    const prevCompleted = completedLessons;
    const prevProgress = courseProgress;

    const newCompleted = new Set(completedLessons);
    newCompleted.delete(lessonId);
    const allLessons = [
      ...course.standaloneLessons,
      ...course.folders.flatMap(f => f.lessons)
    ];
    const newProgress = Math.round((newCompleted.size / allLessons.length) * 100);

    setCompletedLessons(newCompleted);
    setCourseProgress(newProgress);

    try {
      const { error } = await supabase
        .from('lesson_progress')
        .delete()
        .eq('user_id', userProfile.id)
        .eq('lesson_id', lessonId);
      if (error) throw error;
    } catch (error) {
      console.error('Error unmarking lesson:', error);
      setCompletedLessons(prevCompleted);
      setCourseProgress(prevProgress);
      showError('No se pudo actualizar tu progreso. Intenta de nuevo.');
    } finally {
      togglingLessonsRef.current.delete(lessonId);
    }
  };

  const handleAddPage = (folderId?: string) => {
    setAddPageModal({ isOpen: true, folderId });
  };

  const handleAddPageConfirm = async (title: string) => {
    const { folderId } = addPageModal;

    try {
      const newLesson = await createLesson(courseId, { title, folder_id: folderId });
      if (course) {
        if (folderId) {
          // Add to folder
          setCourse({
            ...course,
            folders: course.folders.map((f) =>
              f.id === folderId
                ? { ...f, lessons: [...f.lessons, newLesson] }
                : f
            ),
          });
        } else {
          // Add as standalone
          setCourse({
            ...course,
            standaloneLessons: [...course.standaloneLessons, newLesson],
          });
        }
        setSelectedLesson(newLesson);
        setLessonContent('');
      }
    } catch (error) {
      console.error('Error creating page:', error);
      alert('Error creating page');
    }
  };

  const handleAddFolder = () => {
    setAddFolderModal(true);
  };

  const handleAddFolderConfirm = async (title: string) => {
    try {
      const newFolder = await createFolder(courseId, title);
      if (course) {
        setCourse({
          ...course,
          folders: [...course.folders, { ...newFolder, lessons: [] }],
        });
      }
    } catch (error) {
      console.error('Error creating folder:', error);
      alert('Error creating folder');
    }
  };

  const handleDeleteLesson = async (lessonId: string) => {
    if (!confirm('Delete this page?')) return;

    try {
      await deleteLesson(lessonId);
      if (course) {
        const updatedCourse = {
          ...course,
          standaloneLessons: course.standaloneLessons.filter((l) => l.id !== lessonId),
          folders: course.folders.map((f) => ({
            ...f,
            lessons: f.lessons.filter((l) => l.id !== lessonId),
          })),
        };
        setCourse(updatedCourse);

        // Select another lesson
        if (selectedLesson?.id === lessonId) {
          const nextLesson =
            updatedCourse.standaloneLessons[0] || updatedCourse.folders[0]?.lessons[0];
          setSelectedLesson(nextLesson || null);
          setLessonContent(contenidoVisible(nextLesson));
        }
      }
    } catch (error) {
      console.error('Error deleting lesson:', error);
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (!confirm('Delete this folder and all its pages?')) return;

    try {
      await deleteFolder(folderId);
      if (course) {
        setCourse({
          ...course,
          folders: course.folders.filter((f) => f.id !== folderId),
        });
      }
    } catch (error) {
      console.error('Error deleting folder:', error);
    }
  };

  const handleUpdateLessonTitle = (lesson: Lesson) => {
    setEditLessonModal({ isOpen: true, lesson });
  };

  const handleUpdateLessonTitleConfirm = async (newTitle: string) => {
    const { lesson } = editLessonModal;
    if (!lesson || newTitle === lesson.title) return;

    try {
      await updateLesson(lesson.id, { title: newTitle });
      if (course) {
        const updatedCourse = { ...course };
        updatedCourse.standaloneLessons = updatedCourse.standaloneLessons.map((l) =>
          l.id === lesson.id ? { ...l, title: newTitle } : l
        );
        updatedCourse.folders = updatedCourse.folders.map((f) => ({
          ...f,
          lessons: f.lessons.map((l) =>
            l.id === lesson.id ? { ...l, title: newTitle } : l
          ),
        }));
        setCourse(updatedCourse);
        if (selectedLesson?.id === lesson.id) {
          setSelectedLesson({ ...selectedLesson, title: newTitle } as Lesson);
        }
      }
    } catch (error) {
      console.error('Error updating title:', error);
    }
  };

  const handleUpdateFolderTitle = async (folderId: string, newTitle: string) => {
    if (!course) return;

    try {
      await updateFolder(folderId, { title: newTitle });
      // Update local state
      setCourse({
        ...course,
        folders: course.folders.map((f) =>
          f.id === folderId ? { ...f, title: newTitle } : f
        ),
      });
    } catch (error) {
      console.error('Error updating folder title:', error);
      alert('Error updating folder title');
    }
  };

  const handleReorderFolders = async (folderIds: string[]) => {
    if (!course) return;

    try {
      await reorderFolders(courseId, folderIds);
      // Update local state
      const reorderedFolders = folderIds
        .map((id) => course.folders.find((f) => f.id === id))
        .filter(Boolean) as typeof course.folders;
      setCourse({ ...course, folders: reorderedFolders });
    } catch (error) {
      console.error('Error reordering folders:', error);
    }
  };

  const handleReorderLessons = async (lessonIds: string[], folderId?: string) => {
    if (!course) return;

    try {
      await reorderLessons(lessonIds);
      // Update local state
      if (folderId) {
        setCourse({
          ...course,
          folders: course.folders.map((f) => {
            if (f.id === folderId) {
              const reorderedLessons = lessonIds
                .map((id) => f.lessons.find((l) => l.id === id))
                .filter(Boolean) as Lesson[];
              return { ...f, lessons: reorderedLessons };
            }
            return f;
          }),
        });
      } else {
        const reorderedLessons = lessonIds
          .map((id) => course.standaloneLessons.find((l) => l.id === id))
          .filter(Boolean) as Lesson[];
        setCourse({ ...course, standaloneLessons: reorderedLessons });
      }
    } catch (error) {
      console.error('Error reordering lessons:', error);
    }
  };

  const handleReorderCourseItems = async (
    items: Array<{ id: string; type: 'folder' | 'lesson'; order: number }>
  ) => {
    if (!course) return;

    try {
      await reorderCourseItems(courseId, items);

      // Update local state with new order positions
      const updatedFolders = course.folders.map(f => {
        const item = items.find(i => i.id === f.id && i.type === 'folder');
        return item ? { ...f, order_position: item.order } : f;
      }).sort((a, b) => (a.order_position ?? 0) - (b.order_position ?? 0));

      const updatedStandalone = course.standaloneLessons.map(l => {
        const item = items.find(i => i.id === l.id && i.type === 'lesson');
        return item ? { ...l, order_position: item.order } : l;
      }).sort((a, b) => (a.order_position ?? 0) - (b.order_position ?? 0));

      setCourse({
        ...course,
        folders: updatedFolders,
        standaloneLessons: updatedStandalone,
      });
    } catch (error) {
      console.error('Error reordering course items:', error);
    }
  };

  const handleMoveLesson = async (lessonId: string, targetFolderId: string | null) => {
    if (!course) return;

    try {
      await moveLesson(lessonId, targetFolderId);

      // Find the lesson in current state
      let movedLesson: Lesson | undefined;

      // Check standalone
      movedLesson = course.standaloneLessons.find((l) => l.id === lessonId);

      // Check folders
      if (!movedLesson) {
        for (const folder of course.folders) {
          movedLesson = folder.lessons.find((l) => l.id === lessonId);
          if (movedLesson) break;
        }
      }

      if (!movedLesson) return;

      // Update folder_id - create updated lesson with proper typing
      const updatedLesson: Lesson = {
        ...movedLesson,
        folder_id: targetFolderId
      };

      // Remove from old location
      const updatedStandalone = course.standaloneLessons.filter((l) => l.id !== lessonId);
      const updatedFolders = course.folders.map((f) => ({
        ...f,
        lessons: f.lessons.filter((l) => l.id !== lessonId),
      })) as FolderWithLessons[];

      // Add to new location
      if (targetFolderId) {
        const targetIndex = updatedFolders.findIndex((f) => f.id === targetFolderId);
        if (targetIndex !== -1) {
          updatedFolders[targetIndex].lessons.push(updatedLesson);
        }
        setCourse({ ...course, standaloneLessons: updatedStandalone, folders: updatedFolders });
      } else {
        setCourse({
          ...course,
          standaloneLessons: [...updatedStandalone, updatedLesson],
          folders: updatedFolders,
        });
      }

      // Sync selectedLesson if the moved lesson was selected
      if (selectedLesson?.id === lessonId) {
        setSelectedLesson(updatedLesson);
        setLessonContent(contenidoVisible(updatedLesson));
      }
    } catch (error) {
      console.error('Error moving lesson:', error);
    }
  };

  const handleToggleFolderPublished = async (folderId: string, published: boolean) => {
    if (!course) return;

    try {
      await toggleFolderPublished(folderId, published);
      // Update local state
      setCourse({
        ...course,
        folders: course.folders.map((f) =>
          f.id === folderId ? { ...f, published } : f
        ),
      });
    } catch (error) {
      console.error('Error toggling folder published:', error);
    }
  };

  const handleToggleLessonPublished = async (lessonId: string, published: boolean) => {
    if (!course) return;

    try {
      await toggleLessonPublished(lessonId, published);
      // Update local state
      const updatedCourse = { ...course };
      updatedCourse.standaloneLessons = updatedCourse.standaloneLessons.map((l) =>
        l.id === lessonId ? { ...l, published } : l
      );
      updatedCourse.folders = updatedCourse.folders.map((folder) => ({
        ...folder,
        lessons: folder.lessons.map((l) =>
          l.id === lessonId ? { ...l, published } : l
        ),
      }));
      setCourse(updatedCourse);

      // Update selectedLesson if it's the one being toggled
      if (selectedLesson?.id === lessonId) {
        setSelectedLesson({ ...selectedLesson, published });
      }
    } catch (error) {
      console.error('Error toggling lesson published:', error);
    }
  };

  if (isLoading || isLoadingAuth) {
    // Silueta real (sidebar + header + contenido) en lugar de spinner
    return <CourseViewSkeleton />;
  }

  if (!course) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="glass-panel p-12 rounded-xl text-center">
          <p className="text-muted">Este curso no está disponible.</p>
          <div className="mt-5 flex items-center justify-center gap-4">
            <Link href="/classroom" className="btn-gold text-sm">Volver al Classroom</Link>
          </div>
        </div>
      </div>
    );
  }

  // Lección que es solo un marco narrado de un curso v2: el área le da todo el borde.
  const lessonEsMarco = (selectedLesson as { content_format?: string } | null)?.content_format === 'html'
    && !!lessonContent
    && (() => { const segs = splitLessonContent(lessonContent); return segs.length > 0 && segs.every(sg => sg.kind === 'narrador' && !!sg.curso); })();

  return (
    <div data-focus={isFocusMode ? '1' : '0'} style={{ ['--sf-nav-b' as string]: `${navBottom}px`, } as React.CSSProperties} className={`font-sans flex overflow-hidden relative transition-all duration-300 ${isFocusMode ? 'h-dvh' : 'h-[calc(100dvh-124px-var(--sat))] md:h-[calc(100dvh-var(--sf-nav-b))]'}`}>
      {/* Backdrop móvil del drawer de lecciones */}
      {!isCollapsed && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setIsCollapsed(true)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar: estático en desktop, drawer overlay en móvil */}
      <div
        className={`flex-shrink-0 transition-all duration-300 ease-in-out max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-40 max-md:pt-[var(--sat)] max-md:bg-background ${
          isCollapsed
            ? 'w-0 overflow-hidden'
            : 'w-[min(340px,85vw)] md:w-[340px] max-md:shadow-2xl'
        }`}
      >
        <div className={`h-full transition-opacity duration-200 ${isCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          <CourseSidebar
            courseTitle={course.title}
            folders={course.folders}
            standaloneLessons={course.standaloneLessons}
            selectedLessonId={selectedLesson?.id}
            isAdmin={isAdmin}
            progress={courseProgress}
            completedLessons={completedLessons}
            onLessonSelect={handleLessonSelect}
            onAddFolder={handleAddFolder}
            onAddPage={handleAddPage}
            onDeleteFolder={handleDeleteFolder}
            onDeleteLesson={handleDeleteLesson}
            onUpdateLessonTitle={handleUpdateLessonTitle}
            onUpdateFolderTitle={handleUpdateFolderTitle}
            onReorderFolders={handleReorderFolders}
            onReorderLessons={handleReorderLessons}
            onReorderCourseItems={handleReorderCourseItems}
            onMoveLesson={handleMoveLesson}
            onBack={() => router.push('/classroom')}
            onToggleFolderPublished={handleToggleFolderPublished}
            onToggleLessonPublished={handleToggleLessonPublished}
          />
        </div>
      </div>

      {/* Toggle button (desktop) - fixed position like Skool - hidden in focus mode */}
      {!isFocusMode && (
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute z-20 top-1/2 -translate-y-1/2 w-6 h-12 hidden md:flex items-center justify-center bg-surface border border-primary/30 hover:border-primary rounded-r-lg hover:bg-primary/20 transition-all duration-300 shadow-md"
          style={{ left: isCollapsed ? 0 : SIDEBAR_WIDTH }}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg
            className={`w-4 h-4 text-muted hover:text-primary transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Trigger móvil del drawer de lecciones: pill con label + progreso
          (el chevron de 24px era indescubrible en touch) */}
      {!isFocusMode && isCollapsed && (() => {
        const totalLessons =
          course.standaloneLessons.length +
          course.folders.reduce((sum, f) => sum + f.lessons.length, 0);
        return (
          <button
            onClick={() => setIsCollapsed(false)}
            className={`md:hidden fixed bottom-[var(--sfc-composer-offset,4.5rem)] left-4 z-[45] flex items-center gap-2 pl-3 pr-4 py-2.5 rounded-full bg-surface/95 backdrop-blur-md border border-primary/40 shadow-xl text-sm font-semibold text-foreground active:scale-95 transition-all duration-200 ${pildoraOculta ? 'translate-y-24 opacity-0 pointer-events-none' : ''}`}
            aria-label="Abrir lista de lecciones"
          >
            <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
            </svg>
            Lecciones
            <span className="text-xs text-muted font-normal">
              {completedLessons.size}/{totalLessons}
            </span>
          </button>
        );
      })()}

      {/* Content area - card style - edge-to-edge on mobile */}
      <div className={`flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden relative bg-card ${lessonEsMarco ? '' : 'md:m-4 md:ml-2 md:rounded-xl md:border md:border-glass-strong md:shadow-glass'}`}>
          {/* Lección-marco (curso v2): sin cabecera de título ni márgenes; las dos acciones flotan en la esquina del HTML (el HTML ya trae su título) */}
          {selectedLesson && lessonEsMarco && (
            <div className="absolute top-2 left-2 z-20 flex items-center gap-1.5">
              <button
                onClick={toggleFocusMode}
                className={`w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md transition-all duration-200 ${isFocusMode ? 'bg-primary text-white hover:bg-primary/80' : 'bg-background/55 border border-primary/40 text-primary/70 hover:border-primary hover:text-primary hover:bg-primary/15'}`}
                title={isFocusMode ? 'Salir de modo focus (Ctrl+Shift+F)' : 'Modo focus (Ctrl+Shift+F)'}
                aria-label={isFocusMode ? 'Salir de modo focus' : 'Modo focus'}
              >
                {isFocusMode ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" /></svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" /></svg>
                )}
              </button>
              <button
                onClick={completedLessons.has(selectedLesson.id) ? handleMarkIncomplete : handleMarkComplete}
                className={`w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md transition-all duration-200 ${completedLessons.has(selectedLesson.id) ? 'bg-primary text-white hover:bg-primary/80' : 'bg-background/55 border border-primary/40 text-primary/70 hover:border-primary hover:text-primary hover:bg-primary/15'}`}
                title={completedLessons.has(selectedLesson.id) ? 'Desmarcar' : 'Marcar como completada'}
                aria-label={completedLessons.has(selectedLesson.id) ? 'Desmarcar completada' : 'Marcar como completada'}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
              </button>
            </div>
          )}
          {selectedLesson ? (
            <>
              {/* Lesson header with title + save button + mark complete button (no en lecciones-marco) */}
              {!lessonEsMarco && (
              <div className="px-4 py-4 md:px-8 md:py-6 border-b border-glass flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <h2 className="text-2xl font-black text-foreground">
                    {selectedLesson.title}
                  </h2>

                  {/* Save indicator and button - only show for admins and not in focus mode */}
                  {isAdmin && !isFocusMode && (
                    <div className="flex items-center gap-3">
                      {isSavingManual ? (
                        <div className="flex items-center gap-2 text-muted text-sm">
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span>Guardando...</span>
                        </div>
                      ) : hasUnsavedChanges ? (
                        <button
                          onClick={handleSaveLesson}
                          className="flex items-center gap-2 px-3 py-1.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
                          title="Guardar (Ctrl+S)"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                          </svg>
                          Guardar
                        </button>
                      ) : (
                        <div className="flex items-center gap-2 text-success/70 text-sm">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>Guardado</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2">
                  {/* Focus Mode button */}
                  <button
                    onClick={toggleFocusMode}
                    className={`
                      w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200
                      ${isFocusMode
                        ? 'bg-primary text-white hover:bg-primary/80'
                        : 'border-2 border-primary/50 text-primary/50 hover:border-primary hover:text-primary hover:bg-primary/10'
                      }
                    `}
                    title={isFocusMode ? 'Salir de modo focus (Ctrl+Shift+F)' : 'Modo focus (Ctrl+Shift+F)'}
                  >
                    {isFocusMode ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                      </svg>
                    )}
                  </button>

                  {/* Mark as complete button - circle with checkmark */}
                  <button
                    onClick={completedLessons.has(selectedLesson.id) ? handleMarkIncomplete : handleMarkComplete}
                    className={`
                      w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200
                      ${completedLessons.has(selectedLesson.id)
                        ? 'bg-primary text-white hover:bg-primary/80'
                        : 'border-2 border-primary/50 text-primary/50 hover:border-primary hover:text-primary hover:bg-primary/10'
                      }
                    `}
                    title={completedLessons.has(selectedLesson.id) ? 'Desmarcar' : 'Marcar como completada'}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                </div>
              </div>
              )}

              {/* Content Area */}
              <div
                ref={contentAreaRef}
                className="flex-1 min-h-0 overflow-y-auto"
                onScroll={(e) => {
                  // La pildora flotante de lecciones (movil) se esconde al bajar y
                  // vuelve al subir: asi nunca tapa un control mientras se lee.
                  const top = e.currentTarget.scrollTop;
                  const delta = top - ultimoScrollRef.current;
                  if (Math.abs(delta) > 6) {
                    setPildoraOculta(delta > 0 && top > 80);
                    ultimoScrollRef.current = top;
                  }
                }}
              >
                <div className={lessonEsMarco ? 'lx-marco-lleno' : 'px-4 py-4 md:px-8 md:py-6'}>

                  {/* Linked Post Embed (DRY - Skool-style) - supports multiple posts */}
                  {(() => {
                    // Collect all post IDs from linked_post_id AND content markers
                    let postIds: string[] = [];

                    // 1. Check linked_post_id (primary)
                    if (selectedLesson.linked_post_id) {
                      postIds.push(selectedLesson.linked_post_id);
                    }

                    // 2. Check content for additional post markers: [embed-post:UUID]
                    if (selectedLesson.content) {
                      const embedRegex = /\[embed-post:([a-f0-9-]{36})\]/gi;
                      let match;
                      while ((match = embedRegex.exec(selectedLesson.content)) !== null) {
                        if (!postIds.includes(match[1])) {
                          postIds.push(match[1]);
                        }
                      }
                    }

                    // La capa social (posts enlazados) se pinta ARRIBA y el
                    // contenido de la lección sigue debajo.
                    const capaSocial = postIds.length > 0 ? (
                        <div className="space-y-6">
                          {/* El titulo ya vive en la cabecera de la leccion: aqui NO se
                              repite. La clase grabada se pinta ARRIBA de este bloque
                              (no depende del post); aqui queda la capa social. */}
                          {/* Render each linked post (capa social: comentarios) */}
                          {postIds.map((postId) => (
                            <LinkedPostEmbed
                              key={`${selectedLesson.id}-${postId}`}
                              postId={postId}
                            />
                          ))}
                        </div>
                    ) : null;

                    // Segunda vía de render (Classroom v2): lección generada como
                    // artefacto HTML con piel Luminorphism. NO pasa por TipTap.
                    if ((selectedLesson as { content_format?: string }).content_format === 'html') {
                      // El título ya lo pinta el encabezado del área de contenido:
                      // repetirlo aquí lo duplicaba en pantalla.
                      return (
                        <div className={lessonEsMarco ? "lx-contenido-lleno" : "space-y-6"}>
                          {capaSocial}
                          <LessonHtml
                            key={selectedLesson.id}
                            content={lessonContent}
                            attachments={lessonAttachments}
                          />
                        </div>
                      );
                    }

                    // Sin cuerpo HTML propio: la capa social ES el contenido (comportamiento viejo).
                    if (capaSocial) return capaSocial;

                    // Otherwise render regular editor
                    return (
                      <PageEditor
                        key={selectedLesson.id}
                        content={lessonContent}
                        onChange={setLessonContent}
                        editable={isAdmin}
                        initialAttachments={lessonAttachments}
                        onAttachmentsChange={setLessonAttachments}
                      />
                    );
                  })()}

                  {/* Lesson Navigation - Previous/Next */}
                  {(() => {
                    const allLessons = getAllLessonsOrdered(course);
                    const currentIndex = allLessons.findIndex(l => l.id === selectedLesson.id);
                    const previousLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
                    const nextLesson = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;
                    const totalLessons = allLessons.length;
                    const currentPosition = currentIndex + 1;

                    return (
                      <div className="mt-8 pt-6 border-t border-glass">
                        {/* Progress indicator */}
                        <div className="text-center mb-4">
                          <span className="text-sm text-muted">
                            Lección {currentPosition} de {totalLessons}
                          </span>
                        </div>

                        {/* Navigation buttons */}
                        <div className="flex items-center justify-between gap-4">
                          {/* Previous button */}
                          {previousLesson ? (
                            <button
                              onClick={() => handleLessonSelect(previousLesson)}
                              disabled={isSaving || isSavingManual}
                              className="flex-1 flex items-center gap-3 px-4 py-3 rounded-xl border border-glass hover:border-primary/50 hover:bg-primary/5 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <svg className="w-5 h-5 text-muted group-hover:text-primary transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                              </svg>
                              <div className="text-left min-w-0">
                                <div className="text-xs text-muted uppercase tracking-wide">Anterior</div>
                                <div className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                                  {previousLesson.title}
                                </div>
                              </div>
                            </button>
                          ) : (
                            <div className="flex-1" />
                          )}

                          {/* Next button */}
                          {nextLesson ? (
                            <button
                              onClick={() => handleLessonSelect(nextLesson)}
                              disabled={isSaving || isSavingManual}
                              className="flex-1 flex items-center justify-end gap-3 px-4 py-3 rounded-xl bg-primary/10 border border-primary/30 hover:bg-primary/20 hover:border-primary transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <div className="text-right min-w-0">
                                <div className="text-xs text-primary/70 uppercase tracking-wide">Siguiente</div>
                                <div className="text-sm font-medium text-primary truncate">
                                  {nextLesson.title}
                                </div>
                              </div>
                              <svg className="w-5 h-5 text-primary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                          ) : (
                            <div className="flex-1 flex items-center justify-end">
                              <div className="px-4 py-3 rounded-xl bg-success/10 border border-success/30 text-success text-sm font-medium">
                                Curso completado
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Comments Section - Polymorphic comments for lessons.
                      SIN fixedFormMobile a proposito (30 jul 2026): en movil el
                      composer fijo se comia una franja de la pantalla en TODA la
                      leccion, para una accion que el lector hace al final o nunca.
                      Ahora vive al cierre del hilo: quien quiere comentar baja, y
                      quien viene a leer lee. */}
                  <div className={`${lessonEsMarco ? 'px-3 md:px-6' : ''} pb-20 md:pb-6`}>
                    <CierreLeccion courseId={courseId} courseTitle={course?.title || ''} lessonId={selectedLesson.id} lessonTitle={selectedLesson.title} />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted">
              <div className="text-center">
                <svg className="w-16 h-16 mx-auto mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p>Select a page to view its content</p>
              </div>
            </div>
          )}
        </div>

      {/* Modals */}
      <InputModal
        isOpen={addPageModal.isOpen}
        onClose={() => setAddPageModal({ isOpen: false })}
        onConfirm={handleAddPageConfirm}
        title="Nueva página"
        placeholder="Nombre de la página"
        label="Nombre"
        maxLength={100}
      />

      <InputModal
        isOpen={addFolderModal}
        onClose={() => setAddFolderModal(false)}
        onConfirm={handleAddFolderConfirm}
        title="Nueva carpeta"
        placeholder="Nombre de la carpeta"
        label="Nombre"
        maxLength={100}
      />

      <InputModal
        isOpen={editLessonModal.isOpen}
        onClose={() => setEditLessonModal({ isOpen: false })}
        onConfirm={handleUpdateLessonTitleConfirm}
        title="Editar título"
        placeholder="Nuevo título"
        defaultValue={editLessonModal.lesson?.title || ''}
        label="Título"
        maxLength={100}
      />

      <UnsavedChangesModal
        isOpen={unsavedChangesModal.isOpen}
        onAction={handleUnsavedChangesAction}
        isSaving={isSavingManual}
      />

    </div>
  );
}
