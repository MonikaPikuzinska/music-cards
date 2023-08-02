import styles from './StartPage.module.css'
import {Button} from 'primereact/button'
const StartPage = () => {
    return ( <div className={styles.wrapper}><p className={styles.header}>Music cards</p><Button label='New game' /></div> );
}
 
export default StartPage;