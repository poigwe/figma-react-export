
    import logo from './logo.svg';
    import './App.css';
    import { BrowserRouter, Routes, Route } from "react-router-dom";
    import GET_SCREEN_PHASE  from './get_screen_phase'

    function App() {
    return (
        <div className="App">
        <BrowserRouter>
            <Routes>
            <Route path="/" element={<GET_SCREEN_PHASE />} />
          </Routes>
        </BrowserRouter>
        </div>
    );
    }

    export default App;