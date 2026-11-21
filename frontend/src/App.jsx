import { useCallback, useEffect, useState } from "react";
import {
  borrarReserva,
  crearReserva,
  getHealth,
  listarFranjas,
  listarReservas,
  listarSalas,
} from "./api.js";
import Navbar from "./components/Navbar.jsx";
import BarraFecha from "./components/BarraFecha.jsx";
import GrillaReservas from "./components/GrillaReservas.jsx";
import ReservaModal from "./components/ReservaModal.jsx";
import SalasModal from "./components/SalasModal.jsx";

const INTERVALO_HEALTH_MS = 5000;

const hoyISO = () => {
  const ahora = new Date();
  const local = new Date(ahora.getTime() - ahora.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

export default function App() {
  const [fecha, setFecha] = useState(hoyISO);
  const [salas, setSalas] = useState([]);
  const [franjas, setFranjas] = useState([]);
  const [reservas, setReservas] = useState([]);
  const [health, setHealth] = useState(null);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [reservando, setReservando] = useState(null);
  const [gestionandoSalas, setGestionandoSalas] = useState(false);

  const refrescar = useCallback(async () => {
    try {
      const [listaSalas, listaFranjas, listaReservas] = await Promise.all([
        listarSalas(),
        listarFranjas(),
        listarReservas(fecha),
      ]);
      setSalas(listaSalas);
      setFranjas(listaFranjas);
      setReservas(listaReservas);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, [fecha]);

  useEffect(() => {
    refrescar();
  }, [refrescar]);

  useEffect(() => {
    const consultar = () => getHealth().then(setHealth).catch(() => setHealth(null));
    consultar();
    const id = setInterval(consultar, INTERVALO_HEALTH_MS);
    return () => clearInterval(id);
  }, []);

  const reservar = async (datos) => {
    await crearReserva(datos);
    setReservando(null);
    await refrescar();
  };

  const liberar = async (reserva) => {
    if (!window.confirm(`¿Liberar el turno de ${reserva.responsable}?`)) return;
    try {
      await borrarReserva(reserva.id);
      await refrescar();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <>
      <Navbar
        health={health}
        onGestionarSalas={() => setGestionandoSalas(true)}
      />

      <main className="contenedor">
        {error && (
          <div className="alerta" role="alert">
            <strong>No se puede contactar a reservas-api.</strong> {error}
          </div>
        )}

        <BarraFecha
          fecha={fecha}
          onCambiar={setFecha}
          ocupadas={reservas.length}
          total={salas.length * franjas.length}
          cargando={cargando}
        />

        {cargando ? (
          <p className="vacio">Cargando disponibilidad…</p>
        ) : (
          <GrillaReservas
            salas={salas}
            franjas={franjas}
            reservas={reservas}
            onReservar={(sala, franja) => setReservando({ sala, franja })}
            onLiberar={liberar}
          />
        )}
      </main>

      {reservando && (
        <ReservaModal
          fecha={fecha}
          sala={reservando.sala}
          franja={reservando.franja}
          onGuardar={reservar}
          onCerrar={() => setReservando(null)}
        />
      )}

      {gestionandoSalas && (
        <SalasModal
          salas={salas}
          onCambio={refrescar}
          onCerrar={() => setGestionandoSalas(false)}
        />
      )}
    </>
  );
}
