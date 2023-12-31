
const MyMath = (function MyMathFactory(Math) {

	const MyMath = {};


	// hằng số chuyển đổi độ/radian
	MyMath.toDeg = 180 / Math.PI;
	MyMath.toRad = Math.PI / 180;
	MyMath.halfPI = Math.PI / 2;
	MyMath.twoPI = Math.PI * 2;


// Tính khoảng cách theo định lý Pythagore
	MyMath.dist = (width, height) => {
		return Math.sqrt(width * width + height * height);
	};


// Tính khoảng cách điểm theo định lý Pythagore
// Tương tự như trên, nhưng lấy tọa độ thay vì kích thước.
	MyMath.pointDist = (x1, y1, x2, y2) => {
		const distX = x2 - x1;
		const distY = y2 - y1;
		return Math.sqrt(distX * distX + distY * distY);
	};


// Trả về góc (tính bằng radian) của vectơ 2D
	MyMath.angle = (width, height) => ( MyMath.halfPI + Math.atan2(height, width) );


// Trả về góc (tính bằng radian) giữa hai điểm
// Tương tự như trên, nhưng lấy tọa độ thay vì kích thước.
	MyMath.pointAngle = (x1, y1, x2, y2) => ( MyMath.halfPI + Math.atan2(y2 - y1, x2 - x1) );

// Tách một vectơ tốc độ thành các thành phần x và y (góc phải tính bằng radian)
	MyMath.splitVector = (speed, angle) => ({
		x: Math.sin(angle) * speed,
		y: -Math.cos(angle) * speed
	});


// Tạo một số ngẫu nhiên giữa min (bao gồm) và max (độc quyền)
	MyMath.random = (min, max) => Math.random() * (max - min) + min;


// Tạo một số nguyên ngẫu nhiên giữa và có thể bao gồm các giá trị tối thiểu và tối đa
	MyMath.randomInt = (min, max) => ((Math.random() * (max - min + 1)) | 0) + min;


// Trả về một phần tử ngẫu nhiên từ một mảng hoặc đơn giản là tập hợp các đối số được cung cấp khi được gọi
	MyMath.randomChoice = function randomChoice(choices) {
		if (arguments.length === 1 && Array.isArray(choices)) {
			return choices[(Math.random() * choices.length) | 0];
		}
		return arguments[(Math.random() * arguments.length) | 0];
	};


// Kẹp một số giữa giá trị tối thiểu và tối đa
	MyMath.clamp = function clamp(num, min, max) {
		return Math.min(Math.max(num, min), max);
	};


	return MyMath;

})(Math);