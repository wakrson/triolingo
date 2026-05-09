import { createBrowserRouter } from 'react-router';
import { RootLayout } from './components/RootLayout';
import { HomePage } from './pages/HomePage';
import { LearningPathPage } from './pages/LearningPathPage';
import { LessonPage } from './pages/LessonPage';
import { ProgressPage } from './pages/ProgressPage';
import { ResourcesPage } from './pages/ResourcesPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { AssessmentPage } from './pages/AssessmentPage';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: RootLayout,
    children: [
      { index: true, Component: HomePage },
      { path: 'learning-path', Component: LearningPathPage },
      { path: 'lesson/:nodeId', Component: LessonPage },
      { path: 'progress', Component: ProgressPage },
      { path: 'resources', Component: ResourcesPage },
      { path: 'assessment', Component: AssessmentPage },
      { path: '*', Component: NotFoundPage },
    ],
  },
]);
