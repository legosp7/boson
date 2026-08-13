import { CssBaseline, Box } from "@mui/material";
import { BosonHeader } from "renderer/Components";
import BOSSTemperatureMonitor from "./components/bossgraph";

export default function BossMonitor() {
    return (
        <Box
        component='main'
        display='flex'
        position='absolute'
        width='100%'
        top={0}>
        <CssBaseline />
        <BosonHeader/>
        <BOSSTemperatureMonitor/>
        
        </Box>
    )
}