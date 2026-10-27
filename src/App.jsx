import { BrowserRouter } from 'react-router-dom';
import { StoreProvider } from './context/StoreContext';
import AppRoutes from './routes/AppRoutes';

function App() {
    return (
        <StoreProvider>
            <BrowserRouter>
                <AppRoutes />
            </BrowserRouter>
        </StoreProvider>
    );
}

export default App;
