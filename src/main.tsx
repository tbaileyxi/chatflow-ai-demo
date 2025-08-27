import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { AuthProvider } from './hooks/useAuth.tsx'
import { QueryProvider } from './components/optimized/QueryProvider'
import './index.css'

createRoot(document.getElementById("root")!).render(
  <QueryProvider>
    <AuthProvider>
      <App />
    </AuthProvider>
  </QueryProvider>
);
