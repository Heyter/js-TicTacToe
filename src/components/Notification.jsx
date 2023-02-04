import { useState, useEffect, createRef } from 'react';

export default function Notification(props) {
	const [isClosing, setIsClosing] = useState(false);
	const notifyRef = createRef();

	if (props.autoClose) {
		useEffect(() => {
			if (!isClosing) {
				const id = setTimeout(() => {
					if (notifyRef.current) notifyRef.current.className = '';
					setIsClosing(true);
				}, 3000);

				return () => clearTimeout(id);
			}
		}, [props.autoClose]);
	}

	useEffect(() => {
		if (isClosing) {
			if (notifyRef.current) notifyRef.current.className = '';
			const id = setTimeout(props.onDelete, 200);

			return () => clearTimeout(id);
		}
	}, [isClosing, props.onDelete]);

	return (
		<span
			ref={notifyRef}
			className="show"
			style={{ borderColor: props.color ?? 'gray' }}
			onClick={() => setIsClosing(true)}
		>
			{props.text}
		</span>
	);
}

Notification.defaultProps = {
	text: 'Error',
	color: 'gray', // border color
	autoClose: true,
	onDelete: () => {},
};
