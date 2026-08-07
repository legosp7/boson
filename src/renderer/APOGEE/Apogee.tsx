import { CssBaseline, Box } from "@mui/material";
import { BosonHeader } from "renderer/Components";
import APOGEEWdg from "./Components/APOGEEWdg";

export default function Apogee() {
    return (
        <Box
        component='main'
        display='flex'
        position='absolute'
        width='100%'
        top={0}>
        <CssBaseline />
        <BosonHeader />
        <APOGEEWdg />
        </Box>
    )
    }
